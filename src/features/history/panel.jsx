import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import dayjs from 'dayjs';
import { fetchVideosWithNote } from '../../common/supabase/api.js';
import { getAllNotes } from '../../common/db/index.js';
import { CATEGORIES, formatDate, getCategoryKey, formatNoteTime } from '../../shared/date.js';

const appRef = { setVideos: null, reset: null, refreshNotes: null };

function videoItem(v) {
  return (
    <div
      key={v.bvid}
      className="bili-aux-video-item"
      onClick={() => { if (v.url) window.open(v.url, '_blank'); }}
    >
      <img className="bili-aux-video-cover" src={v.cover} alt="" loading="lazy" />
      <div className="bili-aux-video-info">
        <div className="bili-aux-video-title" title={v.title}>{v.title || ''}</div>
        <div className="bili-aux-video-date">{formatDate(v.date_uploaded)}</div>
      </div>
    </div>
  );
}

function noteItem(v) {
  return (
    <div
      key={v.bvid}
      className="bili-aux-note-item"
      onClick={() => { if (v.url) window.open(v.url, '_blank'); }}
    >
      <div className="bili-aux-note-item-top">
        <img className="bili-aux-video-cover" src={v.cover} alt="" loading="lazy" />
        <div className="bili-aux-video-info">
          <div className="bili-aux-video-title" title={v.title}>{v.title || v.bvid}</div>
          <div className="bili-aux-video-date">{formatDate(v.date_uploaded)}</div>
        </div>
      </div>
      <div className="bili-aux-note-item-bottom">
        <div className="bili-aux-note-text" title={v.note}>{v.note || ''}</div>
        <div className="bili-aux-note-time">
          {v.note_updated_at ? '备注于 ' + formatNoteTime(v.note_updated_at) : ''}
        </div>
      </div>
    </div>
  );
}

function PanelApp() {
  const [videos, setVideos] = useState([]);
  const [noteVideos, setNoteVideos] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState(new Set(['thisMonth']));
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('thisMonth');
  const [panelMode, setPanelMode] = useState('time');
  const [noteSort, setNoteSort] = useState('desc');

  appRef.setVideos = setVideos;
  appRef.reset = () => {
    setVideos([]);
    setNoteVideos([]);
    setExpandedKeys(new Set(['thisMonth']));
    setActiveTab('thisMonth');
    setViewMode('list');
    setPanelMode('time');
    setNoteSort('desc');
  };
  appRef.refreshNotes = loadNoteVideos;

  useEffect(() => {
    if (panelMode === 'note') {
      loadNoteVideos();
    }
  }, [panelMode, noteSort]);

  async function loadNoteVideos() {
    try {
      let noteList = [];
      try {
        noteList = await fetchVideosWithNote();
      } catch (err) {
        noteList = await getAllNotes();
      }

      const enriched = noteList.map(v => ({
        ...v,
        title: v.title || v.bvid,
        cover: v.cover || '',
        url: v.url || `https://www.bilibili.com/video/${v.bvid}`
      }));

      setNoteVideos(enriched);
    } catch (err) {
      console.error('[BiliAux] load notes failed', err);
    }
  }

  const groups = useMemo(() => {
    const g = {};
    CATEGORIES.forEach(c => g[c.key] = []);
    for (const v of videos) {
      const key = getCategoryKey(v.date_uploaded);
      if (g[key]) g[key].push(v);

      if (key === 'today' || key === 'thisWeek' || key === 'thisMonth' || key === 'lastMonth') {
        if (!g['thisQuarter'].includes(v)) g['thisQuarter'].push(v);
      }
      if (key !== 'invalid' && key !== 'longAgo') {
        if (!g['thisYear'].includes(v)) g['thisYear'].push(v);
      }
    }
    return g;
  }, [videos]);

  const categories = useMemo(() => {
    return CATEGORIES
      .filter(c => groups[c.key].length > 0)
      .map(c => ({ ...c, videos: groups[c.key] }));
  }, [groups]);

  const activeVideos = groups[activeTab] || [];

  const sortedNoteVideos = useMemo(() => {
    const sorted = [...noteVideos];
    sorted.sort((a, b) => {
      const tA = a.note_updated_at || 0;
      const tB = b.note_updated_at || 0;
      return noteSort === 'desc' ? tB - tA : tA - tB;
    });
    return sorted;
  }, [noteVideos, noteSort]);

  function toggleCategory(key) {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={'bili-aux-panel' + (isCollapsed ? ' collapsed' : '')}>
      <div className="bili-aux-panel-header">
        <div className="bili-aux-panel-tabs">
          <button
            className={'bili-aux-panel-tab' + (panelMode === 'time' ? ' active' : '')}
            onClick={() => setPanelMode('time')}
          >发布时间</button>
          <button
            className={'bili-aux-panel-tab' + (panelMode === 'note' ? ' active' : '')}
            onClick={() => setPanelMode('note')}
          >备注</button>
        </div>
        <button
          className="bili-aux-panel-toggle"
          title="折叠/展开"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >{isCollapsed ? '+' : '−'}</button>
      </div>

      <div className="bili-aux-panel-body">
        {panelMode === 'time' ? (
          <div className="bili-aux-mode-content">
            <div className="bili-aux-subheader">
              <span className="bili-aux-subheader-title">按发布时间筛选</span>
              <div className="bili-aux-panel-controls">
                <button
                  className={'bili-aux-view-toggle' + (viewMode === 'list' ? ' active' : '')}
                  title="列表视图"
                  onClick={() => setViewMode('list')}
                >☰</button>
                <button
                  className={'bili-aux-view-toggle' + (viewMode === 'tab' ? ' active' : '')}
                  title="面板视图"
                  onClick={() => setViewMode('tab')}
                >▦</button>
              </div>
            </div>
            {videos.length === 0 ? (
              <div className="bili-aux-empty">暂无数据，滚动页面加载更多视频</div>
            ) : viewMode === 'list' ? (
              categories.map(cat => (
                <div
                  key={cat.key}
                  className={'bili-aux-category' + (expandedKeys.has(cat.key) ? ' expanded' : '')}
                  data-key={cat.key}
                >
                  <div className="bili-aux-category-header" onClick={() => toggleCategory(cat.key)}>
                    <span className="bili-aux-category-arrow"></span>
                    <span className="bili-aux-category-name">{cat.label}</span>
                    <span className="bili-aux-category-count">{cat.videos.length}</span>
                  </div>
                  <div className="bili-aux-category-list">
                    {cat.videos.map(videoItem)}
                  </div>
                </div>
              ))
            ) : (
              <div className="bili-aux-tab-view">
                <div className="bili-aux-tab-bar">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      className={'bili-aux-tab' + (activeTab === cat.key ? ' active' : '') + (groups[cat.key].length === 0 ? ' empty' : '')}
                      onClick={() => { if (groups[cat.key].length > 0) setActiveTab(cat.key); }}
                    >
                      {cat.label}
                      <span className="bili-aux-tab-count">{groups[cat.key].length}</span>
                    </button>
                  ))}
                </div>
                <div className="bili-aux-tab-content">
                  {activeVideos.length === 0 ? (
                    <div className="bili-aux-empty">该分类暂无视频</div>
                  ) : (
                    activeVideos.map(videoItem)
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bili-aux-mode-content">
            <div className="bili-aux-subheader">
              <span className="bili-aux-subheader-title">按备注筛选</span>
              <div className="bili-aux-panel-controls">
                <button
                  className={'bili-aux-view-toggle' + (noteSort === 'desc' ? ' active' : '')}
                  title="最新优先"
                  onClick={() => setNoteSort('desc')}
                >↓</button>
                <button
                  className={'bili-aux-view-toggle' + (noteSort === 'asc' ? ' active' : '')}
                  title="最早优先"
                  onClick={() => setNoteSort('asc')}
                >↑</button>
              </div>
            </div>
            {sortedNoteVideos.length === 0 ? (
              <div className="bili-aux-empty">暂无备注视频</div>
            ) : (
              <div className="bili-aux-note-list">
                {sortedNoteVideos.map(noteItem)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

let root = null;

export function mountPanel() {
  if (root) return appRef;

  const container = document.createElement('div');
  container.id = 'bili-aux-panel-root';
  document.body.appendChild(container);

  root = createRoot(container);
  root.render(<PanelApp />);

  return appRef;
}

export function unmountPanel() {
  if (root) {
    root.unmount();
    root = null;
  }
  const container = document.getElementById('bili-aux-panel-root');
  if (container) container.remove();
}
