export function qs(selector, context = document) {
  return context.querySelector(selector);
}

export function qsa(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

export function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

export function ensurePositionRelative(el) {
  if (el && getComputedStyle(el).position === 'static') {
    el.style.position = 'relative';
  }
}

export function observeMutations(target, callback, options = { childList: true, subtree: true }) {
  const observer = new MutationObserver(callback);
  observer.observe(target, options);
  return observer;
}
