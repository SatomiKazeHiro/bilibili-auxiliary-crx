import { formatShortDate } from '../../shared/date.js';
import { getVideo, getNote } from '../../common/db/index.js';
import { el, qsa, qs, ensurePositionRelative, delegate } from '../../shared/dom.js';

const noteClickHandlers = new Map();
let noteClickDelegateInstalled = false;

function ensureNoteClickDelegate() {
  if (noteClickDelegateInstalled) return;
  delegate(document.body, '.note-badge', 'click', (e, target) => {
    const card = target.closest('[data-bili-aux-bvid]');
    const bvid = card?.dataset?.biliAuxBvid;
    if (!bvid) return;
    e.preventDefault();
    e.stopPropagation();
    const handler = noteClickHandlers.get(bvid);
    if (handler) handler(bvid, card);
  });
  noteClickDelegateInstalled = true;
}

export function renderBadge(card, data) {
  if (!data.date_uploaded) return;
  if (qs('.upload-date-badge', card)) return;

  const mainEl = qs('.history-card__main, .bili-video-card__wrap, .history-card__left', card);
  if (!mainEl) return;

  const badge = el('div', {
    class: 'upload-date-badge',
    title: `上传时间: ${data.date_uploaded}`
  }, formatShortDate(data.date_uploaded));

  const wrap = qs('.bili-video-card', card) || mainEl;
  ensurePositionRelative(wrap);

  const cover = qs('.bili-video-card__cover, .bili-cover-card', wrap);
  if (cover) {
    ensurePositionRelative(cover);
    cover.appendChild(badge);
  } else {
    wrap.appendChild(badge);
  }
}

export async function renderBadgeFromDB(card, bvid) {
  const data = await getVideo(bvid);
  if (data) renderBadge(card, data);
}

export async function updateCard(bvid, pageVideos) {
  const cards = qsa(`.history-card[data-bili-aux-bvid="${bvid}"]`);
  const videoData = pageVideos[bvid];
  const noteData = await getNote(bvid);
  for (const card of cards) {
    if (videoData) renderBadge(card, videoData);
    const noteDisplay = qs('.note-display', card);
    if (!noteDisplay) continue;
    const panel = qs('.note-panel', noteDisplay);
    const badge = qs('.note-badge', noteDisplay);
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

export function renderNoteIcon(card, bvid, onClick) {
  if (qs('.note-display', card)) return;

  const wrap = qs('.bili-video-card', card)
    || qs('.history-card__main, .bili-video-card__wrap, .history-card__left', card);
  if (!wrap) return;

  const cover = qs('.bili-video-card__cover, .bili-cover-card', wrap);
  const target = cover || wrap;

  const panel = el('div', { class: 'note-panel' });
  const display = el('div', { class: 'note-display' },
    el('div', { class: 'note-badge', title: '点击添加备注' }, '✎'),
    el('div', { class: 'note-line-left' }),
    el('div', { class: 'note-line-up' }),
    el('div', { class: 'note-line-right' }),
    panel
  );

  ensurePositionRelative(target);

  if (cover) {
    if (!cover.dataset.biliAuxOriginalOverflow) {
      cover.dataset.biliAuxOriginalOverflow = cover.style.overflow || '';
    }
    cover.style.overflow = 'visible';
  }

  noteClickHandlers.set(bvid, onClick);
  ensureNoteClickDelegate();

  target.appendChild(display);

  getNote(bvid).then(noteData => {
    if (noteData && noteData.note) {
      display.classList.add('has-content');
      panel.textContent = noteData.note;
      const badge = qs('.note-badge', display);
      if (badge) badge.classList.add('has-note');
    }
  }).catch(() => {});
}

export function cleanupNoteDisplays() {
  for (const display of qsa('.note-display')) {
    const parent = display.parentElement;
    if (parent && (parent.classList.contains('bili-video-card__cover') || parent.classList.contains('bili-cover-card'))) {
      if (parent.dataset.biliAuxOriginalOverflow !== undefined) {
        parent.style.overflow = parent.dataset.biliAuxOriginalOverflow;
        delete parent.dataset.biliAuxOriginalOverflow;
      }
    }
    const card = display.closest('.history-card');
    const bvid = card?.dataset?.biliAuxBvid;
    if (bvid) noteClickHandlers.delete(bvid);
    display.remove();
  }
}
