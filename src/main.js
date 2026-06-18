import './features/history/history.css';
import './features/video/video.css';

import { startHistory } from './features/history/index.js';
import { startVideo } from './features/video/index.js';

function init() {
  const path = location.pathname;

  if (path === '/history' || path.startsWith('/history/')) {
    startHistory();
    return;
  }

  if (path.startsWith('/video/')) {
    startVideo();
    return;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
