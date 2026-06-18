import { fetchVideosWithNote, batchUpsert } from '../supabase/api.js';
import { getAllVideos } from './videos.js';
import { getAllNotes, clearNotes, batchSaveNotes } from './notes.js';

export async function syncNotesFromSupabase() {
  const remoteNotes = await fetchVideosWithNote();
  if (!remoteNotes || remoteNotes.length === 0) return 0;
  await clearNotes();
  await batchSaveNotes(remoteNotes);
  return remoteNotes.length;
}

export async function uploadLocalToSupabase() {
  const localVideos = await getAllVideos();
  const localNotes = await getAllNotes();
  const noteMap = {};
  localNotes.forEach(n => { noteMap[n.bvid] = n; });

  const merged = localVideos.map(v => {
    const note = noteMap[v.bvid];
    if (note) {
      return { ...v, note: note.note, note_updated_at: note.note_updated_at };
    }
    return v;
  });

  localNotes.forEach(n => {
    if (!merged.some(v => v.bvid === n.bvid)) {
      merged.push(n);
    }
  });

  if (merged.length === 0) return 0;
  return batchUpsert(merged);
}
