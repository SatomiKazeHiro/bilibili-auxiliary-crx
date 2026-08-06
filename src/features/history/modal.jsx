import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../shared/icons.jsx';
import { CATEGORIES, formatDate, formatNoteTime, getCategoryKey } from '../../shared/date.js';

const FILTER_ALL = { key: 'all', label: '全部' };
const FILTER_LIST = [FILTER_ALL, ...CATEGORIES];

function highlight(text, query) {
  if (!query || !text) return text;
  const lowerText = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  const parts = [];
  let last = 0;
  let i = lowerText.indexOf(lowerQ, last);
  while (i !== -1) {
    if (i > last) parts.push(text.slice(last, i));
    parts.push(<span key={i} className="bili-aux-grid-hl">{text.slice(i, i + lowerQ.length)}</span>);
    last = i + lowerQ.length;
    i = lowerText.indexOf(lowerQ, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Modal({ isOpen, onClose, videos, noteVideos, onCardClick }) {
  const [modalMode, setModalMode] = useState('time');
  const [timeSort, setTimeSort] = useState('desc');
  const [noteSort, setNoteSort] = useState('desc');
  const [activeTimeCat, setActiveTimeCat] = useState('all');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

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

  const sortedTimeVideos = useMemo(() => {
    const list = activeTimeCat === 'all' ? videos : (groups[activeTimeCat] || []);
    const sorted = [...list];
    sorted.sort((a, b) => {
      const tA = a.date_uploaded || '';
      const tB = b.date_uploaded || '';
      return timeSort === 'desc' ? tB.localeCompare(tA) : tA.localeCompare(tB);
    });
    return sorted;
  }, [videos, groups, activeTimeCat, timeSort]);

  const sortedNoteVideos = useMemo(() => {
    const sorted = [...noteVideos];
    sorted.sort((a, b) => {
      const tA = a.note_updated_at || 0;
      const tB = b.note_updated_at || 0;
      return noteSort === 'desc' ? tB - tA : tA - tB;
    });
    return sorted;
  }, [noteVideos, noteSort]);

  const q = noteSearchQuery.trim();
  const filteredNoteVideos = useMemo(() => {
    if (!q) return sortedNoteVideos;
    const lowerQ = q.toLowerCase();
    return sortedNoteVideos.filter(v => {
      const title = (v.title || '').toLowerCase();
      const note = (v.note || '').toLowerCase();
      return title.includes(lowerQ) || note.includes(lowerQ);
    });
  }, [sortedNoteVideos, q]);

  if (!isOpen) return null;

  const open = (v) => { if (v.url) onCardClick(v.url); };

  return (
    <div className="bili-aux-grid-modal-overlay" onClick={onClose}>
      <div className="bili-aux-grid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bili-aux-grid-modal-header">
          <div className="bili-aux-grid-modal-tabs">
            <button
              className={'bili-aux-grid-modal-tab' + (modalMode === 'time' ? ' active' : '')}
              onClick={() => setModalMode('time')}
            >发布时间</button>
            <button
              className={'bili-aux-grid-modal-tab' + (modalMode === 'note' ? ' active' : '')}
              onClick={() => setModalMode('note')}
            >备注</button>
          </div>
          <button
            className="bili-aux-grid-modal-close"
            onClick={onClose}
            title="关闭"
            type="button"
          ><Icon name="close" size={18} /></button>
        </div>

        <div className="bili-aux-grid-modal-toolbar">
          {modalMode === 'time' ? (
            <>
              <div className="bili-aux-grid-modal-filters">
                {FILTER_LIST.map(cat => {
                  const count = cat.key === 'all' ? videos.length : (groups[cat.key] || []).length;
                  return (
                    <button
                      key={cat.key}
                      className={'bili-aux-grid-filter' + (activeTimeCat === cat.key ? ' active' : '') + (count === 0 ? ' empty' : '')}
                      onClick={() => setActiveTimeCat(cat.key)}
                    >
                      {cat.label}
                      <span className="bili-aux-grid-filter-count">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="bili-aux-grid-modal-sort">
                <button
                  className={'bili-aux-view-toggle' + (timeSort === 'desc' ? ' active' : '')}
                  onClick={() => setTimeSort('desc')}
                  title="最新优先"
                ><Icon name="sortDesc" size={14} /></button>
                <button
                  className={'bili-aux-view-toggle' + (timeSort === 'asc' ? ' active' : '')}
                  onClick={() => setTimeSort('asc')}
                  title="最早优先"
                ><Icon name="sortAsc" size={14} /></button>
              </div>
            </>
          ) : (
            <>
              <div className="bili-aux-grid-modal-toolbar-left">
                <input
                  className="bili-aux-grid-modal-search"
                  type="text"
                  placeholder="搜索标题或备注"
                  value={noteSearchQuery}
                  onChange={(e) => setNoteSearchQuery(e.target.value)}
                />
                <span className="bili-aux-grid-modal-count">
                  {q ? `${filteredNoteVideos.length}/${sortedNoteVideos.length} 条` : `共 ${sortedNoteVideos.length} 条`}
                </span>
              </div>
              <div className="bili-aux-grid-modal-sort">
                <button
                  className={'bili-aux-view-toggle' + (noteSort === 'desc' ? ' active' : '')}
                  onClick={() => setNoteSort('desc')}
                  title="最新备注优先"
                ><Icon name="sortDesc" size={14} /></button>
                <button
                  className={'bili-aux-view-toggle' + (noteSort === 'asc' ? ' active' : '')}
                  onClick={() => setNoteSort('asc')}
                  title="最早备注优先"
                ><Icon name="sortAsc" size={14} /></button>
              </div>
            </>
          )}
        </div>

        <div className="bili-aux-grid-modal-body">
          {modalMode === 'time' ? (
            sortedTimeVideos.length === 0 ? (
              <div className="bili-aux-grid-empty">该分类暂无视频</div>
            ) : (
              <div className="bili-aux-grid-cards">
                {sortedTimeVideos.map((v) => (
                  <div key={v.bvid} className="bili-aux-grid-card" onClick={() => open(v)}>
                    <img className="bili-aux-grid-card-cover" src={v.cover} alt="" loading="lazy" />
                    <div className="bili-aux-grid-card-title" title={v.title}>{v.title || ''}</div>
                    <div className="bili-aux-grid-card-date">{formatDate(v.date_uploaded)}</div>
                  </div>
                ))}
              </div>
            )
          ) : (
            sortedNoteVideos.length === 0 ? (
              <div className="bili-aux-grid-empty">暂无备注视频</div>
            ) : filteredNoteVideos.length === 0 ? (
              <div className="bili-aux-grid-empty">无匹配结果</div>
            ) : (
              <div className="bili-aux-grid-cards">
                {filteredNoteVideos.map((v) => (
                  <div key={v.bvid} className="bili-aux-grid-card" onClick={() => open(v)}>
                    <img className="bili-aux-grid-card-cover" src={v.cover} alt="" loading="lazy" />
                    <div className="bili-aux-grid-card-title" title={v.title}>{highlight(v.title, q) || v.bvid}</div>
                    <div className="bili-aux-grid-card-date">{formatDate(v.date_uploaded)}</div>
                    <div className="bili-aux-grid-card-note" title={v.note} onClick={(e) => e.stopPropagation()}>
                      <div className="text">{highlight(v.note, q) || ''}</div>
                      <div className="mask text">{highlight(v.note, q) || ''}</div>
                    </div>
                    <div className="bili-aux-grid-card-note-time">
                      {v.note_updated_at ? '备注于 ' + formatNoteTime(v.note_updated_at) : ''}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
