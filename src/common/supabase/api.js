import { getClient } from './client.js';
import { toDbRecord, fromDbRecord } from './mapper.js';
import { SUPABASE_TABLE_NAME } from '../config/index.js';

const TABLE_NAME = SUPABASE_TABLE_NAME;

export async function fetchAll() {
  const { data, error } = await getClient()
    .from(TABLE_NAME)
    .select('*');
  if (error) throw error;
  return (data || []).map(fromDbRecord);
}

export async function fetchByBvid(bvid) {
  const { data, error } = await getClient()
    .from(TABLE_NAME)
    .select('*')
    .eq('bvid', bvid)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? fromDbRecord(data) : null;
}

export async function upsertVideo(video) {
  const record = toDbRecord(video);
  const { data, error } = await getClient()
    .from(TABLE_NAME)
    .upsert(record, { onConflict: 'bvid' })
    .select()
    .single();
  if (error) throw error;
  return data ? fromDbRecord(data) : null;
}

export async function batchUpsert(videos) {
  if (!videos || videos.length === 0) return 0;
  const BATCH_SIZE = 50;
  let uploaded = 0;
  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE).map(toDbRecord);
    const { error } = await getClient()
      .from(TABLE_NAME)
      .upsert(batch, { onConflict: 'bvid' });
    if (error) throw error;
    uploaded += batch.length;
  }
  return uploaded;
}

export async function fetchVideosWithNote() {
  const { data, error } = await getClient()
    .from(TABLE_NAME)
    .select('*')
    .neq('note', '')
    .order('note_updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDbRecord);
}
