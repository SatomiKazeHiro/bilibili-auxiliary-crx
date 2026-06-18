export function findCards() {
  return Array.from(document.querySelectorAll('.history-card'));
}

export function parseCard(card) {
  const linkEl = card.querySelector('a[href*="/video/BV"]')
    || card.querySelector('a[href*="/video/av"]')
    || card.querySelector('a[href*="/video/"]');
  if (!linkEl) return null;

  const href = linkEl.getAttribute('href') || '';
  const match = href.match(/\/video\/(BV[\w]+)/i);
  if (!match) return null;

  const bvid = match[1];
  const url = href.startsWith('http') ? href : 'https:' + href;

  const titleEl = card.querySelector('.bili-video-card__title a, .history-card__title, .title, h3');
  const title = titleEl ? (titleEl.textContent || titleEl.getAttribute('title') || '').trim() : '';

  const imgEl = card.querySelector('.bili-cover-card__thumbnail img, .history-card__cover img, img');
  const cover = imgEl ? (imgEl.getAttribute('src') || '').trim() : '';

  return { bvid, url, title, cover };
}
