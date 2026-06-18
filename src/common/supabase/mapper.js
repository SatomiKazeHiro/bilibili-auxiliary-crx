export function toDbRecord(video) {
  return {
    bvid: video.bvid,
    title: video.title || '',
    url: video.url || '',
    cover: video.cover || '',
    note: video.note || '',
    tags: Array.isArray(video.tags) ? video.tags : [],
    is_invalid: video.is_invalid === true,
    date_published: video.date_published || null,
    date_uploaded: video.date_uploaded || null,
    note_updated_at: video.note_updated_at ? new Date(video.note_updated_at).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function fromDbRecord(row) {
  return {
    bvid: row.bvid,
    title: row.title || '',
    url: row.url || '',
    cover: row.cover || '',
    note: row.note || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    is_invalid: row.is_invalid === true,
    date_published: row.date_published || '',
    date_uploaded: row.date_uploaded || '',
    note_updated_at: row.note_updated_at ? new Date(row.note_updated_at).getTime() : Date.now()
  };
}
