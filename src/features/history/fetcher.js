import { saveVideo } from '../../common/db/index.js';

export async function fetchVideoInfo(info) {


  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.warn('[BiliAux] fetch timeout', info.bvid);
    controller.abort();
  }, 10000);

  try {
    const resp = await fetch(`https://www.bilibili.com/video/${info.bvid}`, {
      method: 'GET',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    clearTimeout(timeout);



    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const htmlText = await resp.text();
    const meta = parseVideoPage(htmlText);

    const videoData = {
      bvid: info.bvid,
      url: info.url,
      title: info.title,
      cover: info.cover,
      date_uploaded: meta.date_uploaded || '',
      date_published: meta.date_published || '',
      tags: meta.tags || [],
      is_invalid: !meta.date_uploaded
    };

    await saveVideo(videoData);

    return videoData;
  } catch (err) {
    console.warn('[BiliAux] fetch failed for', info.bvid, err.name, err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseVideoPage(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  const uploadMeta = doc.querySelector('meta[itemprop="uploadDate"]');
  const publishMeta = doc.querySelector('meta[itemprop="datePublished"]');

  const date_uploaded = uploadMeta ? uploadMeta.getAttribute('content') || '' : '';
  const date_published = publishMeta ? publishMeta.getAttribute('content') || '' : '';

  let tags = [];
  const tagsMatch = htmlText.match(/"tags"\s*:\s*(\[[\s\S]*?\])\s*[,}\]]/);
  if (tagsMatch) {
    try {
      tags = JSON.parse(tagsMatch[1]);
    } catch (e) {
      // ignore
    }
  }

  return { date_uploaded, date_published, tags };
}
