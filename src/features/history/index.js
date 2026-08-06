import { parseCard, findCards, getCardTitle, getCardCover, getCardBvidAndUrl } from './parser.js';
import { fetchVideoInfo } from './fetcher.js';
import { renderBadgeFromDB, renderNoteIcon, updateCard, cleanupNoteDisplays } from './renderer.js';
import { openNoteEditor } from './note-editor.js';
import { initPanel, resetPanel, updatePanel, refreshPanelNotes, destroyPanel } from './panel-bridge.js';
import { getVideo, getNote, syncNotesFromSupabase, getAllVideos, uploadLocalToSupabase } from '../../common/db/index.js';
import { observeMutations } from '../../shared/dom.js';

const SEEN_BVIDS = new Set();
const PENDING_BVIDS = new Set();
const FETCH_QUEUE = [];
let debounceTimer = null;
let isProcessing = false;
let isBatching = false;
let isActive = false;
let observerInstance = null;
const CONCURRENCY = 5;

const pageVideos = {};

function shouldActivate() {
  return location.pathname === '/history' || location.pathname.startsWith('/history/');
}

function refreshPanel() {
  updatePanel(Object.values(pageVideos));
}

function processNewCards() {
  if (isProcessing) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processNewCards, 300);
    return;
  }
  isProcessing = true;

  const cards = findCards();
  if (cards.length === 0) {
    isProcessing = false;
    return;
  }

  const toFetch = [];

  for (const card of cards) {
    if (card.dataset.biliAuxProcessed === '1') continue;

    const info = parseCard(card);
    if (!info || !info.bvid) continue;

    card.dataset.biliAuxProcessed = '1';
    card.dataset.biliAuxBvid = info.bvid;
    renderNoteIcon(card, info.bvid, handleNoteClick);

    if (!pageVideos[info.bvid]) {
      pageVideos[info.bvid] = { ...info, date_uploaded: '', date_published: '', tags: [], is_invalid: false };
    } else {
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

  for (const info of toFetch) {
    FETCH_QUEUE.push(info);
  }

  isProcessing = false;
  refreshPanel();
  runFetchQueue();
}

async function runFetchQueue() {
  if (isBatching) return;
  isBatching = true;

  try {
    while (FETCH_QUEUE.length > 0) {
      const batch = FETCH_QUEUE.splice(0, CONCURRENCY);


      const missing = [];
      for (const info of batch) {
        const cached = await getVideo(info.bvid);
        if (cached && cached.date_uploaded) {
          pageVideos[info.bvid] = cached;
          await updateCard(info.bvid, pageVideos);
        } else {
          missing.push(info);
        }
      }

      if (missing.length > 0) {
        const results = await Promise.allSettled(missing.map(info => fetchVideoInfoWithState(info)));
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            pageVideos[result.value.bvid] = result.value;
            await updateCard(result.value.bvid, pageVideos);
          }
        }
      }
    }
  } catch (err) {
    console.error('[BiliAux] runFetchQueue error', err);
  } finally {
    isBatching = false;
  }

  if (FETCH_QUEUE.length > 0) {
    setTimeout(runFetchQueue, 0);
  }

  refreshPanel();
}

async function fetchVideoInfoWithState(info) {
  if (PENDING_BVIDS.has(info.bvid)) return null;
  PENDING_BVIDS.add(info.bvid);
  try {
    return await fetchVideoInfo(info);
  } finally {
    PENDING_BVIDS.delete(info.bvid);
  }
}

async function handleNoteClick(bvid, card) {
  const noteData = await getNote(bvid);
  const videoData = await getVideo(bvid);
  const cardLink = getCardBvidAndUrl(card);
  const data = {
    bvid,
    title: (noteData?.title || videoData?.title) || getCardTitle(card) || bvid,
    cover: (noteData?.cover || videoData?.cover) || getCardCover(card) || '',
    url: (noteData?.url || videoData?.url) || cardLink?.url || `https://www.bilibili.com/video/${bvid}`,
    note: noteData?.note || '',
    date_uploaded: videoData?.date_uploaded || '',
    date_published: videoData?.date_published || '',
    tags: videoData?.tags || [],
    is_invalid: videoData?.is_invalid || false,
  };
  openNoteEditor(bvid, data, {
    pageVideos,
    onSave: async (savedBvid) => {
      await updateCard(savedBvid, pageVideos);
      refreshPanel();
      refreshPanelNotes();
    }
  });
}

function scheduleProcess() {
  if (!isActive) return;
  setTimeout(processNewCards, 500);
  setTimeout(processNewCards, 1500);
  setTimeout(processNewCards, 3000);
}

function initObserver() {
  if (observerInstance) return;

  observerInstance = observeMutations(document.body, (mutations) => {
    if (!isActive) return;
    const hasNew = mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0);
    if (hasNew) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processNewCards, 300);
    }
  });
}

function resetState() {
  SEEN_BVIDS.clear();
  PENDING_BVIDS.clear();
  FETCH_QUEUE.length = 0;
  Object.keys(pageVideos).forEach(k => delete pageVideos[k]);
  document.querySelectorAll('.history-card[data-bili-aux-processed]').forEach(c => {
    c.removeAttribute('data-bili-aux-processed');
    c.removeAttribute('data-bili-aux-bvid');
  });
  cleanupNoteDisplays();
  resetPanel();
}

function stop() {
  isActive = false;
  resetState();
  if (observerInstance) {
    observerInstance.disconnect();
    observerInstance = null;
  }
  destroyPanel();
}

function initRouteWatcher() {
  let lastPath = location.pathname;
  const checkRoute = () => {
    const currentPath = location.pathname;
    if (currentPath === lastPath) return;
    lastPath = currentPath;

    if (currentPath.startsWith('/history')) {
      resetState();
      startHistory();
    } else {
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

async function startHistory() {
  if (isActive) return;
  if (!shouldActivate()) {
    return;
  }

  cleanupNoteDisplays();

  isActive = true;
  initPanel();
  initObserver();

  try {
    await syncNotesFromSupabase();
  } catch (err) {
    console.warn('[BiliAux] sync notes from Supabase failed', err.message);
  }

  scheduleProcess();
  processNewCards();
}

window.BiliAuxUploadLocal = async function () {
  try {
    const localCount = (await getAllVideos()).length;
    if (localCount === 0) {
      return 0;
    }
    const uploaded = await uploadLocalToSupabase();
    return uploaded;
  } catch (err) {
    console.error('[BiliAux] manual upload failed', err.message);
    throw err;
  }
};

export { startHistory };
