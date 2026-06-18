import { formatShortDate } from '../../shared/date.js';
import { getVideo, getNote } from '../../common/db/index.js';

export function renderBadge(card, data) {
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

export async function renderBadgeFromDB(card, bvid) {
  const data = await getVideo(bvid);
  if (data) {
    renderBadge(card, data);
  }
}

export async function updateCard(bvid, pageVideos) {
  const cards = document.querySelectorAll(`.history-card[data-bili-aux-bvid="${bvid}"]`);
  const videoData = pageVideos[bvid];
  const noteData = await getNote(bvid);
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

export async function renderNoteIcon(card, bvid, onClick) {
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
    onClick(bvid, card);
  });

  target.appendChild(display);

  try {
    const noteData = await getNote(bvid);
    if (noteData && noteData.note) {
      display.classList.add('has-content');
      panel.textContent = noteData.note;
      badge.classList.add('has-note');
    }
  } catch (e) {
    // ignore
  }
}

export function cleanupNoteDisplays() {
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
