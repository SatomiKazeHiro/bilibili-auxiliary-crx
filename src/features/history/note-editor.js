import { saveNote } from '../../common/db/index.js';
import { upsertVideo } from '../../common/supabase/api.js';
import { el } from '../../shared/dom.js';

export function openNoteEditor(bvid, data, { pageVideos, onSave }) {
  const title = data?.title || bvid;
  const cover = data?.cover || '';
  const currentNote = data?.note || '';

  const cancelBtn = el('button', { class: 'bili-aux-modal-btn cancel' }, '取消');
  const saveBtn = el('button', { class: 'bili-aux-modal-btn save' }, '保存');
  const textarea = el('textarea', {
    class: 'bili-aux-modal-textarea',
    placeholder: '输入备注内容...',
    value: currentNote
  });

  const overlay = el('div', { class: 'bili-aux-modal-overlay' },
    el('div', { class: 'bili-aux-modal' },
      el('div', { class: 'bili-aux-modal-header' }, '编辑备注'),
      el('div', { class: 'bili-aux-modal-preview' },
        el('img', { src: cover, alt: title })
      ),
      el('div', { class: 'bili-aux-modal-subtitle', title }, title),
      textarea,
      el('div', { class: 'bili-aux-modal-actions' }, cancelBtn, saveBtn)
    )
  );

  document.body.appendChild(overlay);
  textarea.focus();

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') close();
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', escHandler);

  saveBtn.addEventListener('click', async () => {
    const note = textarea.value.trim();
    saveBtn.disabled = true;
    saveBtn.replaceChildren(el('span', { class: 'bili-aux-spinner' }), '保存中...');

    const restore = () => {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    };

    try {
      const noteData = {
        bvid,
        title: data?.title || bvid,
        cover: data?.cover || '',
        url: data?.url || `https://www.bilibili.com/video/${bvid}`,
        date_uploaded: data?.date_uploaded || '',
        date_published: data?.date_published || '',
        tags: data?.tags || [],
        is_invalid: data?.is_invalid || false,
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
    } catch (err) {
      restore();
      console.error('[BiliAux] save note failed', err);
    }
  });
}
