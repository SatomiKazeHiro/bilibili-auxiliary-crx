import { getNote, getVideo, saveNote } from '../../common/db/index.js';
import { upsertVideo } from '../../common/supabase/api.js';

export function openNoteEditor(bvid, title, currentNote, cover, card, { pageVideos, onSave }) {
  const overlay = document.createElement('div');
  overlay.className = 'bili-aux-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'bili-aux-modal';

  const header = document.createElement('div');
  header.className = 'bili-aux-modal-header';
  header.textContent = '编辑备注';

  const preview = document.createElement('div');
  preview.className = 'bili-aux-modal-preview';
  const previewImg = document.createElement('img');
  previewImg.src = cover;
  previewImg.alt = title;
  preview.appendChild(previewImg);

  const subTitle = document.createElement('div');
  subTitle.className = 'bili-aux-modal-subtitle';
  subTitle.textContent = title;
  subTitle.title = title;

  const textarea = document.createElement('textarea');
  textarea.className = 'bili-aux-modal-textarea';
  textarea.value = currentNote;
  textarea.placeholder = '输入备注内容...';

  const actions = document.createElement('div');
  actions.className = 'bili-aux-modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bili-aux-modal-btn cancel';
  cancelBtn.textContent = '取消';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'bili-aux-modal-btn save';
  saveBtn.textContent = '保存';

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modal.appendChild(header);
  modal.appendChild(preview);
  modal.appendChild(subTitle);
  modal.appendChild(textarea);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  textarea.focus();

  function close() {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    document.removeEventListener('keydown', escHandler);
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
    }
  };
  document.addEventListener('keydown', escHandler);

  saveBtn.addEventListener('click', async () => {
    const note = textarea.value.trim();

    const noteExisting = await getNote(bvid);
    const videoExisting = await getVideo(bvid);
    const existing = noteExisting || videoExisting || {};
    const cardTitleEl = card.querySelector('.bili-video-card__title a, .history-card__title, .title, h3');
    const cardImgEl = card.querySelector('.bili-cover-card__thumbnail img, .history-card__cover img, img');
    const cardLinkEl = card.querySelector('a[href*="/video/BV"]');
    const href = cardLinkEl ? cardLinkEl.getAttribute('href') : '';

    const noteData = {
      bvid,
      title: existing?.title || cardTitleEl?.textContent?.trim() || bvid,
      cover: existing?.cover || cardImgEl?.getAttribute('src') || '',
      url: existing?.url || (href ? (href.startsWith('http') ? href : 'https:' + href) : `https://www.bilibili.com/video/${bvid}`),
      date_uploaded: existing?.date_uploaded || '',
      date_published: existing?.date_published || '',
      tags: existing?.tags || [],
      is_invalid: existing?.is_invalid || false,
      note,
      note_updated_at: Date.now()
    };

    await saveNote(noteData);

    let remoteUpdatedAt = null;
    try {
      const videoToUpsert = pageVideos[bvid] ? { ...pageVideos[bvid] } : { ...noteData };
      videoToUpsert.note = note;
      videoToUpsert.note_updated_at = Date.now();
      const remoteVideo = await upsertVideo(videoToUpsert);
      remoteUpdatedAt = remoteVideo?.note_updated_at;
    } catch (err) {
      console.warn('[BiliAux] upsert video to Supabase failed', bvid, err.message);
    }

    if (pageVideos[bvid]) {
      pageVideos[bvid].note = note;
      if (remoteUpdatedAt) pageVideos[bvid].note_updated_at = remoteUpdatedAt;
    }

    onSave(bvid);
    close();
  });
}
