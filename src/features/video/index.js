import { processCurrentSection, observeSlideInner, markProcessed, isProcessed } from './duration.js';

const START_DELAY = 6000;
const RECHECK_DURATION = 12000;
const RECHECK_INTERVAL = 1000;
const SLIDE_OBSERVER_START = 10000;

function getVisiblePod() {
  return document.querySelector('.video-pod');
}

function scheduleRecheck(pod) {
  const start = Date.now();
  const timer = setInterval(() => {
    if (Date.now() - start > RECHECK_DURATION) {
      clearInterval(timer);
      return;
    }
    processCurrentSection(pod);
  }, RECHECK_INTERVAL);
}

function init(pod) {
  if (isProcessed(pod)) {
    processCurrentSection(pod);
    return;
  }
  markProcessed(pod);

  processCurrentSection(pod);
  scheduleRecheck(pod);

  const observerDelay = Math.max(0, SLIDE_OBSERVER_START - START_DELAY);
  setTimeout(() => observeSlideInner(pod), observerDelay);
}

function startLookingForPod() {
  const pod = getVisiblePod();
  if (pod) {
    init(pod);
    return;
  }

  let attempts = 0;
  const maxAttempts = RECHECK_DURATION / RECHECK_INTERVAL;
  const timer = setInterval(() => {
    attempts++;
    const found = getVisiblePod();
    if (found) {
      clearInterval(timer);
      init(found);
      return;
    }
    if (attempts >= maxAttempts) {
      clearInterval(timer);
    }
  }, RECHECK_INTERVAL);
}

export function startVideo() {
  setTimeout(startLookingForPod, START_DELAY);
}
