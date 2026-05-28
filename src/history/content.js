/**
 * 主内容脚本
 * - 监听 DOM 变化，解析历史记录卡片
 * - 获取/缓存视频元数据
 * - 渲染时间标签和联动面板
 */
(function () {
  'use strict';

  const DB = window.BiliAuxDB;
  const Panel = window.BiliAuxPanel;

  const SEEN_BVIDS = new Set();
  const PENDING_BVIDS = new Set();
  let debounceTimer = null;
  let isProcessing = false;

  // ========== 当前页面已识别的视频（面板的唯一数据源） ==========
  const pageVideos = {};

  // ========== DOM 监听 ==========

  let observerInstance = null;

  function initObserver() {
    if (observerInstance) return;

    observerInstance = new MutationObserver((mutations) => {
      if (!isActive) return;
      let hasNew = false;
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          hasNew = true;
          break;
        }
      }
      if (hasNew) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processNewCards, 300);
      }
    });

    observerInstance.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function scheduleProcess() {
    if (!isActive) return;
    setTimeout(processNewCards, 500);
    setTimeout(processNewCards, 1500);
    setTimeout(processNewCards, 3000);
  }

  function initRouteWatcher() {
    let lastPath = location.pathname;
    const checkRoute = () => {
      const currentPath = location.pathname;
      if (currentPath === lastPath) return;
      lastPath = currentPath;

      if (currentPath.startsWith('/history')) {
        console.log('[BiliAux] route changed to history, start');
        SEEN_BVIDS.clear();
        Object.keys(pageVideos).forEach(k => delete pageVideos[k]);
        document.querySelectorAll('.history-card[data-bili-aux-processed]').forEach(c => {
          c.removeAttribute('data-bili-aux-processed');
          c.removeAttribute('data-bili-aux-bvid');
        });
        Panel.reset();
        start();
      } else {
        console.log('[BiliAux] route changed away from history, stop');
        stop();
      }
    };

    window.addEventListener('popstate', checkRoute);

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = function (...args) {
      originalPush.apply(this, args);
      setTimeout(checkRoute, 0);
    };
    history.replaceState = function (...args) {
      originalReplace.apply(this, args);
      setTimeout(checkRoute, 0);
    };
  }

  // ========== 卡片解析 ==========

  function processNewCards() {
    if (isProcessing) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processNewCards, 300);
      return;
    }
    isProcessing = true;

    const cards = document.querySelectorAll('.history-card');
    console.log('[BiliAux] processNewCards found', cards.length, 'cards, url=', location.href);

    if (cards.length === 0) {
      const candidates = [
        '.history-card',
        '.history-timeline-item',
        '.section-cards',
        '.timeline-item',
        '[class*="history"]',
        '[class*="card"]'
      ];
      for (const sel of candidates) {
        const nodes = document.querySelectorAll(sel);
        if (nodes.length > 0) {
          console.log('[BiliAux] candidate', sel, '=', nodes.length);
        }
      }
    }

    const toFetch = [];

    for (const card of cards) {
      if (card.dataset.biliAuxProcessed === '1') continue;

      const info = parseCard(card);
      if (!info || !info.bvid) continue;

      card.dataset.biliAuxProcessed = '1';
      card.dataset.biliAuxBvid = info.bvid;
      renderNoteIcon(card, info.bvid);

      // 加入当前页面数据源
      if (!pageVideos[info.bvid]) {
        pageVideos[info.bvid] = { ...info, uploadDate: '', datePublished: '', tags: [], isInvalid: false };
      } else {
        // 更新基础信息（链接/标题/封面可能变化）
        pageVideos[info.bvid].url = info.url;
        pageVideos[info.bvid].title = info.title;
        pageVideos[info.bvid].cover = info.cover;
      }

      if (SEEN_BVIDS.has(info.bvid)) {
        renderBadgeFromDB(card, info.bvid);
        continue;
      }

      SEEN_BVIDS.add(info.bvid);
      toFetch.push(info);
    }

    if (toFetch.length > 0) {
      console.log('[BiliAux] need fetch', toFetch.length, 'videos');
      processBatch(toFetch).finally(() => { isProcessing = false; });
    } else {
      refreshPanel();
      isProcessing = false;
    }
  }

  function parseCard(card) {
    const linkEl = card.querySelector('a[href*="/video/BV"]')
      || card.querySelector('a[href*="/video/av"]')
      || card.querySelector('a[href*="/video/"]');
    if (!linkEl) {
      console.log('[BiliAux] no video link found in card', card.className);
      return null;
    }

    const href = linkEl.getAttribute('href') || '';
    const match = href.match(/\/video\/(BV[\w]+)/i);
    if (!match) {
      console.log('[BiliAux] no bvid match in href:', href);
      return null;
    }

    const bvid = match[1];
    const url = href.startsWith('http') ? href : 'https:' + href;

    const titleEl = card.querySelector('.bili-video-card__title a, .history-card__title, .title, h3');
    const title = titleEl ? (titleEl.textContent || titleEl.getAttribute('title') || '').trim() : '';

    const imgEl = card.querySelector('.bili-cover-card__thumbnail img, .history-card__cover img, img');
    const cover = imgEl ? (imgEl.getAttribute('src') || '').trim() : '';

    return { bvid, url, title, cover };
  }

  // ========== 数据获取 ==========

  async function processBatch(infos) {
    const missing = [];
    for (const info of infos) {
      const cached = await DB.getVideo(info.bvid);
      if (cached) {
        pageVideos[info.bvid] = cached;
        updateCard(info.bvid, cached);
      } else {
        missing.push(info);
      }
    }

    if (missing.length === 0) {
      refreshPanel();
      return;
    }

    const CONCURRENCY = 3;
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const batch = missing.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(info => fetchVideoInfo(info)));
    }

    refreshPanel();
  }

  async function fetchVideoInfo(info) {
    if (PENDING_BVIDS.has(info.bvid)) return;
    PENDING_BVIDS.add(info.bvid);

    try {
      const resp = await fetch(`https://www.bilibili.com/video/${info.bvid}`, {
        method: 'GET',
        credentials: 'omit',
        headers: {
          'Accept': 'text/html,application/xhtml+xml'
        }
      });

      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const htmlText = await resp.text();
      const meta = parseVideoPage(htmlText);

      const videoData = {
        bvid: info.bvid,
        url: info.url,
        title: info.title,
        cover: info.cover,
        uploadDate: meta.uploadDate || '',
        datePublished: meta.datePublished || '',
        tags: meta.tags || [],
        isInvalid: !meta.uploadDate
      };

      await DB.saveVideo(videoData);
      pageVideos[info.bvid] = videoData;
      updateCard(info.bvid, videoData);
    } catch (err) {
      console.warn('[BiliAux] fetch failed for', info.bvid, err.message);
    } finally {
      PENDING_BVIDS.delete(info.bvid);
    }
  }

  function parseVideoPage(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const uploadMeta = doc.querySelector('meta[itemprop="uploadDate"]');
    const publishMeta = doc.querySelector('meta[itemprop="datePublished"]');

    const uploadDate = uploadMeta ? uploadMeta.getAttribute('content') || '' : '';
    const datePublished = publishMeta ? publishMeta.getAttribute('content') || '' : '';

    let tags = [];
    const tagsMatch = htmlText.match(/"tags"\s*:\s*(\[[\s\S]*?\])\s*[,}\]]/);
    if (tagsMatch) {
      try {
        tags = JSON.parse(tagsMatch[1]);
      } catch (e) {
        // ignore
      }
    }

    return { uploadDate, datePublished, tags };
  }

  // ========== UI 渲染 ==========

  function updateCard(bvid, data) {
    const cards = document.querySelectorAll(`.history-card[data-bili-aux-bvid="${bvid}"]`);
    for (const card of cards) {
      renderBadge(card, data);
      const noteBadge = card.querySelector('.note-badge');
      if (noteBadge && data.note) {
        noteBadge.classList.add('has-note');
        noteBadge.title = data.note;
      }
    }
  }

  async function renderBadgeFromDB(card, bvid) {
    const data = await DB.getVideo(bvid);
    if (data) {
      pageVideos[bvid] = data;
      renderBadge(card, data);
    }
    renderNoteIcon(card, bvid);
  }

  function renderBadge(card, data) {
    if (!data.uploadDate) return;
    if (card.querySelector('.upload-date-badge')) return;

    const mainEl = card.querySelector('.history-card__main, .bili-video-card__wrap, .history-card__left');
    if (!mainEl) return;

    const badge = document.createElement('div');
    badge.className = 'upload-date-badge';
    badge.textContent = formatShortDate(data.uploadDate);
    badge.title = `上传时间: ${data.uploadDate}`;

    const wrap = card.querySelector('.bili-video-card') || mainEl;
    if (wrap && getComputedStyle(wrap).position === 'static') {
      wrap.style.position = 'relative';
    }

    const cover = wrap.querySelector('.bili-video-card__cover, .bili-cover-card');
    if (cover) {
      if (getComputedStyle(cover).position === 'static') {
        cover.style.position = 'relative';
      }
      cover.appendChild(badge);
    } else {
      wrap.appendChild(badge);
    }
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = dayjs(dateStr.replace(' ', 'T'));
    if (!d.isValid()) return dateStr;
    const now = dayjs();
    return d.isSame(now, 'year') ? d.format('MM-DD') : d.format('YYYY-MM-DD');
  }

  async function renderNoteIcon(card, bvid) {
    if (card.querySelector('.note-badge')) return;

    const wrap = card.querySelector('.bili-video-card')
      || card.querySelector('.history-card__main, .bili-video-card__wrap, .history-card__left');
    if (!wrap) return;

    const cover = wrap.querySelector('.bili-video-card__cover, .bili-cover-card');
    const target = cover || wrap;

    const badge = document.createElement('div');
    badge.className = 'note-badge';
    badge.innerHTML = '✎';
    badge.title = '点击添加备注';

    if (target && getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }

    try {
      const dbData = await DB.getVideo(bvid);
      if (dbData && dbData.note) {
        badge.classList.add('has-note');
        badge.title = dbData.note;
      }
    } catch (e) {
      // ignore
    }

    badge.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dbData = await DB.getVideo(bvid);
      const titleEl = card.querySelector('.bili-video-card__title a, .history-card__title, .title, h3');
      const title = dbData?.title || titleEl?.textContent?.trim() || bvid;
      openNoteEditor(bvid, title, dbData?.note || '');
    });

    target.appendChild(badge);
  }

  function openNoteEditor(bvid, title, currentNote) {
    const overlay = document.createElement('div');
    overlay.className = 'bili-aux-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'bili-aux-modal';

    const header = document.createElement('div');
    header.className = 'bili-aux-modal-header';
    header.textContent = '编辑备注';

    const subTitle = document.createElement('div');
    subTitle.className = 'bili-aux-modal-subtitle';
    subTitle.textContent = title;
    subTitle.title = title;

    const textarea = document.createElement('textarea');
    textarea.className = 'bili-aux-modal-textarea';
    textarea.value = currentNote;
    textarea.placeholder = '输入备注内容...';

    const actions = document.createElement('div');
    actions.className = 'bili-aux-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bili-aux-modal-btn cancel';
    cancelBtn.textContent = '取消';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'bili-aux-modal-btn save';
    saveBtn.textContent = '保存';

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(header);
    modal.appendChild(subTitle);
    modal.appendChild(textarea);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    textarea.focus();

    function close() {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      document.removeEventListener('keydown', escHandler);
    }

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', escHandler);

    saveBtn.addEventListener('click', async () => {
      const note = textarea.value.trim();
      await DB.updateNote(bvid, note);

      if (pageVideos[bvid]) {
        pageVideos[bvid].note = note;
      }

      document.querySelectorAll(`.history-card[data-bili-aux-bvid="${bvid}"] .note-badge`).forEach(badge => {
        if (note) {
          badge.classList.add('has-note');
          badge.title = note;
        } else {
          badge.classList.remove('has-note');
          badge.title = '点击添加备注';
        }
      });

      close();
    });
  }

  async function refreshPanel() {
    const videos = Object.values(pageVideos);
    Panel.update(videos);
  }

  // ========== 初始化 ==========

  let isActive = false;

  function shouldActivate() {
    return location.pathname === '/history' || location.pathname.startsWith('/history/');
  }

  function start() {
    if (isActive) return;
    if (!shouldActivate()) {
      console.log('[BiliAux] not on history page, standby. path=', location.pathname);
      return;
    }
    isActive = true;
    Panel.init();
    initObserver();
    scheduleProcess();
    console.log('[BiliAux] activated on history page, path=', location.pathname + location.search);
    processNewCards();
  }

  function stop() {
    isActive = false;
    Object.keys(pageVideos).forEach(k => delete pageVideos[k]);
    SEEN_BVIDS.clear();
    Panel.reset && Panel.reset();
  }

  function init() {
    if (!DB || !Panel) {
      console.error('[BiliAux] DB or Panel not loaded');
      return;
    }
    initRouteWatcher();
    start();
    console.log('[BiliAux] B站历史记录辅助插件已初始化, path=', location.pathname + location.search);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
