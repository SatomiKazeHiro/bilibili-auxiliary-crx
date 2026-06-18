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
  const FETCH_QUEUE = [];
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
        FETCH_QUEUE.length = 0;
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
        pageVideos[info.bvid] = { ...info, date_uploaded: '', date_published: '', tags: [], is_invalid: false };
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
      console.log('[BiliAux] enqueue', toFetch.length, 'videos to fetch queue');
      for (const info of toFetch) {
        FETCH_QUEUE.push(info);
      }
    }

    isProcessing = false;
    refreshPanel();
    runFetchQueue();
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

  let isBatching = false;
  const CONCURRENCY = 5;

  async function runFetchQueue() {
    if (isBatching) return;
    isBatching = true;

    try {
      while (FETCH_QUEUE.length > 0) {
        const batch = FETCH_QUEUE.splice(0, CONCURRENCY);
        console.log('[BiliAux] fetch batch', batch.length, batch.map(b => b.bvid));

        // 先检查本地缓存，命中直接渲染
        const missing = [];
        for (const info of batch) {
          const cached = await DB.getVideo(info.bvid);
          if (cached && cached.date_uploaded) {
            pageVideos[info.bvid] = cached;
            await updateCard(info.bvid);
          } else {
            missing.push(info);
          }
        }

        if (missing.length > 0) {
          await Promise.allSettled(missing.map(info => fetchVideoInfo(info)));
        }
      }
    } catch (err) {
      console.error('[BiliAux] runFetchQueue error', err);
    } finally {
      isBatching = false;
    }

    // 运行期间可能又有新任务入队，再触发一次
    if (FETCH_QUEUE.length > 0) {
      setTimeout(runFetchQueue, 0);
    }

    refreshPanel();
  }

  async function fetchVideoInfo(info) {
    console.log('[BiliAux] fetchVideoInfo called', info?.bvid);
    if (PENDING_BVIDS.has(info.bvid)) {
      console.log('[BiliAux] fetchVideoInfo already pending', info.bvid);
      return;
    }
    PENDING_BVIDS.add(info.bvid);

    console.log('[BiliAux] fetching', info.bvid);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.warn('[BiliAux] fetch timeout', info.bvid);
        controller.abort();
      }, 10000);

      const resp = await fetch(`https://www.bilibili.com/video/${info.bvid}`, {
        method: 'GET',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml'
        }
      });
      clearTimeout(timeout);

      console.log('[BiliAux] fetch response', info.bvid, resp.status);

      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const htmlText = await resp.text();
      const meta = parseVideoPage(htmlText);

      const videoData = {
        bvid: info.bvid,
        url: info.url,
        title: info.title,
        cover: info.cover,
        date_uploaded: meta.date_uploaded || '',
        date_published: meta.date_published || '',
        tags: meta.tags || [],
        is_invalid: !meta.date_uploaded
      };

      await DB.saveVideo(videoData);
      pageVideos[info.bvid] = videoData;
      await updateCard(info.bvid);
      console.log('[BiliAux] fetch success', info.bvid, videoData.date_uploaded);
    } catch (err) {
      console.warn('[BiliAux] fetch failed for', info.bvid, err.name, err.message);
    } finally {
      PENDING_BVIDS.delete(info.bvid);
    }
  }

  function parseVideoPage(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const uploadMeta = doc.querySelector('meta[itemprop="uploadDate"]');
    const publishMeta = doc.querySelector('meta[itemprop="datePublished"]');

    const date_uploaded = uploadMeta ? uploadMeta.getAttribute('content') || '' : '';
    const date_published = publishMeta ? publishMeta.getAttribute('content') || '' : '';

    let tags = [];
    const tagsMatch = htmlText.match(/"tags"\s*:\s*(\[[\s\S]*?\])\s*[,}\]]/);
    if (tagsMatch) {
      try {
        tags = JSON.parse(tagsMatch[1]);
      } catch (e) {
        // ignore
      }
    }

    return { date_uploaded, date_published, tags };
  }

  // ========== UI 渲染 ==========

  async function updateCard(bvid) {
    const cards = document.querySelectorAll(`.history-card[data-bili-aux-bvid="${bvid}"]`);
    const videoData = pageVideos[bvid];
    const noteData = await DB.getNote(bvid);
    for (const card of cards) {
      if (videoData) renderBadge(card, videoData);
      const noteDisplay = card.querySelector('.note-display');
      if (noteDisplay) {
        const panel = noteDisplay.querySelector('.note-panel');
        const badge = noteDisplay.querySelector('.note-badge');
        if (noteData && noteData.note) {
          noteDisplay.classList.add('has-content');
          if (panel) panel.textContent = noteData.note;
          if (badge) badge.classList.add('has-note');
        } else {
          noteDisplay.classList.remove('has-content');
          if (panel) panel.textContent = '';
          if (badge) badge.classList.remove('has-note');
        }
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
    if (!data.date_uploaded) return;
    if (card.querySelector('.upload-date-badge')) return;

    const mainEl = card.querySelector('.history-card__main, .bili-video-card__wrap, .history-card__left');
    if (!mainEl) return;

    const badge = document.createElement('div');
    badge.className = 'upload-date-badge';
    badge.textContent = formatShortDate(data.date_uploaded);
    badge.title = `上传时间: ${data.date_uploaded}`;

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
    if (card.querySelector('.note-display')) return;

    const wrap = card.querySelector('.bili-video-card')
      || card.querySelector('.history-card__main, .bili-video-card__wrap, .history-card__left');
    if (!wrap) return;

    const cover = wrap.querySelector('.bili-video-card__cover, .bili-cover-card');
    const target = cover || wrap;

    const display = document.createElement('div');
    display.className = 'note-display';

    const badge = document.createElement('div');
    badge.className = 'note-badge';
    badge.innerHTML = '✎';
    badge.title = '点击添加备注';

    const lineLeft = document.createElement('div');
    lineLeft.className = 'note-line-left';
    const lineUp = document.createElement('div');
    lineUp.className = 'note-line-up';
    const lineRight = document.createElement('div');
    lineRight.className = 'note-line-right';

    const panel = document.createElement('div');
    panel.className = 'note-panel';

    display.appendChild(badge);
    display.appendChild(lineLeft);
    display.appendChild(lineUp);
    display.appendChild(lineRight);
    display.appendChild(panel);

    if (target && getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }

    if (cover) {
      if (!cover.dataset.biliAuxOriginalOverflow) {
        cover.dataset.biliAuxOriginalOverflow = cover.style.overflow || '';
      }
      cover.style.overflow = 'visible';
    }

    badge.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const noteData = await DB.getNote(bvid);
      const videoData = await DB.getVideo(bvid);
      const data = noteData || videoData;
      const titleEl = card.querySelector('.bili-video-card__title a, .history-card__title, .title, h3');
      const title = data?.title || titleEl?.textContent?.trim() || bvid;
      openNoteEditor(bvid, title, data?.note || '', data?.cover || "", card);
    });

    target.appendChild(display);

    try {
      const noteData = await DB.getNote(bvid);
      if (noteData && noteData.note) {
        display.classList.add('has-content');
        panel.textContent = noteData.note;
        badge.classList.add('has-note');
      }
    } catch (e) {
      // ignore
    }
  }

  function openNoteEditor(bvid, title, currentNote, cover, card) {
    const overlay = document.createElement('div');
    overlay.className = 'bili-aux-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'bili-aux-modal';

    const header = document.createElement('div');
    header.className = 'bili-aux-modal-header';
    header.textContent = '编辑备注';

    const preview = document.createElement('div');
    preview.className = 'bili-aux-modal-preview';
    const previewImg = document.createElement("img");
    previewImg.src = cover;
    previewImg.alt = title;
    preview.appendChild(previewImg)

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
    modal.appendChild(preview);
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

      // 组装完整数据：保留数据库已有字段，补充当前 DOM 可见信息
      const noteExisting = await DB.getNote(bvid);
      const videoExisting = await DB.getVideo(bvid);
      const existing = noteExisting || videoExisting || {};
      const cardTitleEl = card.querySelector('.bili-video-card__title a, .history-card__title, .title, h3');
      const cardImgEl = card.querySelector('.bili-cover-card__thumbnail img, .history-card__cover img, img');
      const cardLinkEl = card.querySelector('a[href*="/video/BV"]');
      const href = cardLinkEl ? cardLinkEl.getAttribute('href') : '';

      const noteData = {
        bvid,
        title: existing?.title || cardTitleEl?.textContent?.trim() || bvid,
        cover: existing?.cover || cardImgEl?.getAttribute('src') || '',
        url: existing?.url || (href ? (href.startsWith('http') ? href : 'https:' + href) : `https://www.bilibili.com/video/${bvid}`),
        date_uploaded: existing?.date_uploaded || '',
        date_published: existing?.date_published || '',
        tags: existing?.tags || [],
        is_invalid: existing?.is_invalid || false,
        note,
        note_updated_at: Date.now()
      };

      await DB.saveNote(noteData);

      // 提交到 Supabase，并刷新本地和面板
      let remoteUpdatedAt = null;
      try {
        if (window.BiliAuxSupabase) {
          const videoToUpsert = pageVideos[bvid] ? { ...pageVideos[bvid] } : { ...noteData };
          videoToUpsert.note = note;
          videoToUpsert.note_updated_at = Date.now();
          const remoteVideo = await window.BiliAuxSupabase.upsertVideo(videoToUpsert);
          remoteUpdatedAt = remoteVideo?.note_updated_at;
        }
      } catch (err) {
        console.warn('[BiliAux] upsert video to Supabase failed', bvid, err.message);
      }

      if (pageVideos[bvid]) {
        pageVideos[bvid].note = note;
        if (remoteUpdatedAt) pageVideos[bvid].note_updated_at = remoteUpdatedAt;
      }

      await updateCard(bvid);
      refreshPanel();
      Panel.refreshNotes && Panel.refreshNotes();

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

  async function start() {
    if (isActive) return;
    if (!shouldActivate()) {
      console.log('[BiliAux] not on history page, standby. path=', location.pathname);
      return;
    }

    // 清理旧的 note-display 和恢复 overflow
    document.querySelectorAll('.note-display').forEach(el => {
      const parent = el.parentElement;
      if (parent && (parent.classList.contains('bili-video-card__cover') || parent.classList.contains('bili-cover-card'))) {
        if (parent.dataset.biliAuxOriginalOverflow !== undefined) {
          parent.style.overflow = parent.dataset.biliAuxOriginalOverflow;
          delete parent.dataset.biliAuxOriginalOverflow;
        }
      }
      el.remove();
    });

    isActive = true;
    Panel.init();
    initObserver();

    // 启动时从 Supabase 同步备注到本地，让滚动加载的新卡片也能显示备注
    try {
      if (window.BiliAuxSupabase) {
        const synced = await DB.syncNotesFromSupabase();
        console.log('[BiliAux] synced', synced, 'notes from Supabase');
      }
    } catch (err) {
      console.warn('[BiliAux] sync notes from Supabase failed', err.message);
    }

    scheduleProcess();
    console.log('[BiliAux] activated on history page, path=', location.pathname + location.search);
    processNewCards();
  }

  function stop() {
    isActive = false;
    Object.keys(pageVideos).forEach(k => delete pageVideos[k]);
    SEEN_BVIDS.clear();
    FETCH_QUEUE.length = 0;
    Panel.reset && Panel.reset();

    // 清理 note-display
    document.querySelectorAll('.note-display').forEach(el => {
      const parent = el.parentElement;
      if (parent && (parent.classList.contains('bili-video-card__cover') || parent.classList.contains('bili-cover-card'))) {
        if (parent.dataset.biliAuxOriginalOverflow !== undefined) {
          parent.style.overflow = parent.dataset.biliAuxOriginalOverflow;
          delete parent.dataset.biliAuxOriginalOverflow;
        }
      }
      el.remove();
    });
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

  // 手动上传本地数据到 Supabase（控制台执行：BiliAuxUploadLocal()）
  window.BiliAuxUploadLocal = async function () {
    if (!window.BiliAuxSupabase) {
      console.error('[BiliAux] Supabase not loaded');
      return 0;
    }
    try {
      const localCount = (await DB.getAllVideos()).length;
      if (localCount === 0) {
        console.log('[BiliAux] no local data to upload');
        return 0;
      }
      console.log('[BiliAux] uploading', localCount, 'local videos...');
      const uploaded = await DB.uploadLocalToSupabase();
      console.log('[BiliAux] uploaded', uploaded, 'videos to Supabase');
      return uploaded;
    } catch (err) {
      console.error('[BiliAux] manual upload failed', err.message);
      throw err;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
