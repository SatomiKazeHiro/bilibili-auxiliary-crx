import { qsa } from '../../shared/dom.js';

const TITLE_SEL = '.bili-video-card__title a, .history-card__title, .title, h3';
const COVER_SEL = '.bili-cover-card__thumbnail img, .history-card__cover img, img';

export function findCards() {
  return qsa('.history-card');
}

export function getCardLink(card) {
  return card.querySelector('a[href*="/video/BV"]')
    || card.querySelector('a[href*="/video/av"]')
    || card.querySelector('a[href*="/video/"]');
}

export function getCardBvidAndUrl(card) {
  const linkEl = getCardLink(card);
  if (!linkEl) return null;
  const href = linkEl.getAttribute('href') || '';
  const match = href.match(/\/video\/(BV[\w]+)/i);
  if (!match) return null;
  return { bvid: match[1], url: href.startsWith('http') ? href : 'https:' + href };
}

export function getCardTitle(card) {
  const titleEl = card.querySelector(TITLE_SEL);
  return titleEl ? (titleEl.textContent || titleEl.getAttribute('title') || '').trim() : '';
}

export function getCardCover(card) {
  const imgEl = card.querySelector(COVER_SEL);
  return imgEl ? (imgEl.getAttribute('src') || '').trim() : '';
}

export function parseCard(card) {
  const link = getCardBvidAndUrl(card);
  if (!link) return null;
  return { ...link, title: getCardTitle(card), cover: getCardCover(card) };
}
