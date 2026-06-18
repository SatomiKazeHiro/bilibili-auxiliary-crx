/**
 * 视频播放页辅助：计算视频选集总时长
 * - 单列表：在 .header-top .right 显示总时长
 * - 多子集：在当前激活的 .slide-item 右侧显示该子集时长
 *
 * 策略：
 * 1. 页面加载 6 秒后，在 12 秒内每秒轮询一次，兜底 Vue 二次渲染覆盖。
 * 2. 页面加载 10 秒后，对 .slide-inner 的 style 属性做轻量 Observer，
 *    当 left 变化（子集切换）时，若当前 .slide-item.active 还没有时长标签，
 *    则重新计算并挂载。
 */
(function () {
  'use strict';

  const PROCESSED_ATTR = 'data-bili-aux-duration-processed';
  const START_DELAY = 6000;        // 6 秒后开始查找
  const RECHECK_DURATION = 12000;  // 轮询持续 12 秒
  const RECHECK_INTERVAL = 1000;   // 每秒一次
  const SLIDE_OBSERVER_START = 10000; // 10 秒后开始监听 slide-inner

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

  function processCurrentSection(pod) {
    const listEl = pod.querySelector('.video-pod__list');
    if (!listEl) return;
    const duration = calcListDuration(listEl);

    if (!isMultiSection(pod)) {
      renderTotalDuration(pod, duration);
      return;
    }

    renderSlideItemDuration(pod, duration);
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

  // 监听 .slide-inner 的 style 变化（子集切换时 left 会改变）
  function observeSlideInner(pod) {
    if (!isMultiSection(pod)) return;
    const slideInner = pod.querySelector('.slide-inner');
    if (!slideInner) return;

    const observer = new MutationObserver(() => {
      const activeSlide = pod.querySelector('.slide-item.active');
      if (!activeSlide) return;
      // 若当前 active 子集已挂载时长标签，则不再处理
      if (activeSlide.querySelector('.bili-aux-slide-duration')) return;
      processCurrentSection(pod);
    });

    observer.observe(slideInner, { attributes: true, attributeFilter: ['style'] });
  }

  function init(pod) {
    if (pod.getAttribute(PROCESSED_ATTR) === '1') {
      processCurrentSection(pod);
      return;
    }
    pod.setAttribute(PROCESSED_ATTR, '1');

    processCurrentSection(pod);
    scheduleRecheck(pod);

    // 在 10 秒（绝对时间）左右启动 slide-inner 监听
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

  function bootstrap() {
    setTimeout(startLookingForPod, START_DELAY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
