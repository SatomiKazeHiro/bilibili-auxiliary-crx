/**
 * Supabase 客户端封装
 * 表名: MyBilibiliHistory
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://vwcplqvrgpznjmtdbqtz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_U5hJr79SdFy3Rcrdm9LOsQ_bMsBm9-g';
  const TABLE_NAME = 'MyBilibiliHistory';

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /**
   * 本地视频对象 -> Supabase 行记录
   */
  function toDbRecord(video) {
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

  /**
   * Supabase 行记录 -> 本地视频对象
   */
  function fromDbRecord(row) {
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

  window.BiliAuxSupabase = {
    client,

    /**
     * 拉取全部数据
     */
    async fetchAll() {
      const { data, error } = await client
        .from(TABLE_NAME)
        .select('*');
      if (error) throw error;
      return (data || []).map(fromDbRecord);
    },

    /**
     * 按 bvid 拉取单条
     */
    async fetchByBvid(bvid) {
      const { data, error } = await client
        .from(TABLE_NAME)
        .select('*')
        .eq('bvid', bvid)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data ? fromDbRecord(data) : null;
    },

    /**
     * 单条 upsert（完整视频数据）
     */
    async upsertVideo(video) {
      const record = toDbRecord(video);
      const { data, error } = await client
        .from(TABLE_NAME)
        .upsert(record, { onConflict: 'bvid' })
        .select()
        .single();
      if (error) throw error;
      return data ? fromDbRecord(data) : null;
    },

    /**
     * 批量 upsert（完整视频数据）
     */
    async batchUpsert(videos) {
      if (!videos || videos.length === 0) return 0;

      const BATCH_SIZE = 50;
      let uploaded = 0;
      for (let i = 0; i < videos.length; i += BATCH_SIZE) {
        const batch = videos.slice(i, i + BATCH_SIZE).map(toDbRecord);
        const { error } = await client
          .from(TABLE_NAME)
          .upsert(batch, { onConflict: 'bvid' });
        if (error) throw error;
        uploaded += batch.length;
      }
      return uploaded;
    },

    /**
     * 拉取所有带备注的视频，按 note_updated_at 倒序
     */
    async fetchVideosWithNote() {
      const { data, error } = await client
        .from(TABLE_NAME)
        .select('*')
        .neq('note', '')
        .order('note_updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(fromDbRecord);
    }
  };
})();
