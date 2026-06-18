import { withStore, VIDEO_STORE } from './core.js';

export async function getVideo(bvid) {
  return withStore(VIDEO_STORE, 'readonly', (store) => store.get(bvid));
}

export async function saveVideo(video) {
  const existing = await getVideo(video.bvid);
  const merged = { ...(existing || {}), ...video };
  return withStore(VIDEO_STORE, 'readwrite', (store) => store.put(merged));
}

export async function getAllVideos() {
  return withStore(VIDEO_STORE, 'readonly', (store) => store.getAll());
}
