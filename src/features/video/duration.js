const PROCESSED_ATTR = 'data-bili-aux-duration-processed';

function parseDuration(text) {
  if (!text) return 0;
  const parts = text.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  let seconds = 0;
  for (let i = 0; i < parts.length; i++) {
    seconds = seconds * 60 + parts[i];
  }
  return seconds;
}

function formatDuration(totalSeconds) {
  if (totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getVisiblePod() {
  return document.querySelector('.video-pod');
}

function isMultiSection(pod) {
  return pod.querySelector('.pod-slide') !== null;
}

function calcListDuration(listEl) {
  let total = 0;
  const durations = listEl.querySelectorAll('.stat-item.duration');
  for (let i = 0; i < durations.length; i++) {
    total += parseDuration(durations[i].textContent);
  }
  return total;
}

function ensureHeaderTopRight(pod) {
  const headerTop = pod.querySelector('.header-top');
  if (!headerTop) return null;
  let right = headerTop.querySelector('.right');
  if (!right) {
    right = document.createElement('div');
    right.className = 'right';
    headerTop.appendChild(right);
  }
  return right;
}

function renderTotalDuration(pod, duration) {
  const right = ensureHeaderTopRight(pod);
  if (!right) return;
  let badge = right.querySelector('.bili-aux-total-duration');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'bili-aux-total-duration';
    right.appendChild(badge);
  }
  badge.textContent = `总时长 ${formatDuration(duration)}`;
}

function renderSlideItemDuration(pod, duration) {
  const activeSlide = pod.querySelector('.slide-item.active');
  if (!activeSlide) return;
  let badge = activeSlide.querySelector('.bili-aux-slide-duration');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'bili-aux-slide-duration';
    activeSlide.appendChild(badge);
  }
  badge.textContent = ` (${formatDuration(duration)})`;
}

export function processCurrentSection(pod) {
  const listEl = pod.querySelector('.video-pod__list');
  if (!listEl) return;
  const duration = calcListDuration(listEl);

  if (!isMultiSection(pod)) {
    renderTotalDuration(pod, duration);
    return;
  }

  renderSlideItemDuration(pod, duration);
}

export function observeSlideInner(pod) {
  if (!isMultiSection(pod)) return;
  const slideInner = pod.querySelector('.slide-inner');
  if (!slideInner) return;

  const observer = new MutationObserver(() => {
    const activeSlide = pod.querySelector('.slide-item.active');
    if (!activeSlide) return;
    if (activeSlide.querySelector('.bili-aux-slide-duration')) return;
    processCurrentSection(pod);
  });

  observer.observe(slideInner, { attributes: true, attributeFilter: ['style'] });
}

export function markProcessed(pod) {
  pod.setAttribute(PROCESSED_ATTR, '1');
}

export function isProcessed(pod) {
  return pod.getAttribute(PROCESSED_ATTR) === '1';
}
