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

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node) {
      node[k] = v;
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function delegate(root, selector, type, handler) {
  root.addEventListener(type, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}
