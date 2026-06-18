/**
 * 右侧面板逻辑：时间分类、渲染、交互
 * React 18 + dayjs
 * 支持列表视图 / 选项卡面板视图切换
 */
(function () {
  'use strict';

  const h = React.createElement;
  const { useState, useMemo, useEffect } = React;
  const { createRoot } = ReactDOM;

  const CATEGORIES = [
    { key: 'today', label: '今天' },
    { key: 'thisWeek', label: '本周' },
    { key: 'thisMonth', label: '本月' },
    { key: 'lastMonth', label: '上月' },
    { key: 'thisQuarter', label: '本季度' },
    { key: 'thisYear', label: '本年' },
    { key: 'longAgo', label: '很久以前' },
    { key: 'invalid', label: '已失效' }
  ];

  function getCategoryKey(dateStr) {
    if (!dateStr) return 'invalid';
    const d = dayjs(dateStr.replace(' ', 'T'));
    if (!d.isValid()) return 'invalid';

    const now = dayjs();

    if (d.isSame(now, 'day')) return 'today';

    const weekStart = now.startOf('week').add(1, 'day');
    const weekEnd = weekStart.add(6, 'day').endOf('day');
    if (d.isAfter(weekStart.subtract(1, 'ms')) && d.isBefore(weekEnd.add(1, 'ms'))) return 'thisWeek';

    if (d.isSame(now, 'month')) return 'thisMonth';
    if (d.isSame(now.subtract(1, 'month'), 'month')) return 'lastMonth';

    const quarter = Math.floor(now.month() / 3);
    const qStart = now.startOf('year').add(quarter * 3, 'month');
    const qEnd = qStart.add(3, 'month').subtract(1, 'ms');
    if (d.isAfter(qStart.subtract(1, 'ms')) && d.isBefore(qEnd.add(1, 'ms'))) return 'thisQuarter';

    if (d.isSame(now, 'year')) return 'thisYear';

    return 'longAgo';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '未知';
    const d = dayjs(dateStr.replace(' ', 'T'));
    return d.isValid() ? d.format('YYYY-MM-DD') : '未知';
  }

  // 视频项子组件（两个视图共用）
  function videoItem(v) {
    return h('div', {
      key: v.bvid,
      className: 'bili-aux-video-item',
      onClick: () => { if (v.url) window.open(v.url, '_blank'); }
    },
      h('img', { className: 'bili-aux-video-cover', src: v.cover, alt: '', loading: 'lazy' }),
      h('div', { className: 'bili-aux-video-info' },
        h('div', { className: 'bili-aux-video-title', title: v.title }, v.title || ''),
        h('div', { className: 'bili-aux-video-date' }, formatDate(v.date_uploaded))
      )
    );
  }

  // 外部通过此 ref 操作 React 状态
  const appRef = { setVideos: null, reset: null, refreshNotes: null };

  function PanelApp() {
    const [videos, setVideos] = useState([]);
    const [noteVideos, setNoteVideos] = useState([]);
    const [expandedKeys, setExpandedKeys] = useState(new Set(['thisMonth']));
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'tab'
    const [activeTab, setActiveTab] = useState('thisMonth');
    const [panelMode, setPanelMode] = useState('time'); // 'time' | 'note'
    const [noteSort, setNoteSort] = useState('desc'); // 'desc' | 'asc'

    // 暴露 setter 给外部
    appRef.setVideos = setVideos;
    appRef.refreshNotes = loadNoteVideos;
    appRef.reset = () => {
      setVideos([]);
      setNoteVideos([]);
      setExpandedKeys(new Set(['thisMonth']));
      setActiveTab('thisMonth');
      setViewMode('list');
      setPanelMode('time');
      setNoteSort('desc');
    };

    useEffect(() => {
      if (panelMode === 'note') {
        loadNoteVideos();
      }
    }, [panelMode, noteSort]);

    async function loadNoteVideos() {
      try {
        const SB = window.BiliAuxSupabase;
        let noteList = [];
        if (SB) {
          noteList = await SB.fetchVideosWithNote(); // 含完整字段
        } else {
          noteList = await window.BiliAuxDB.getAllNotes();
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

    // 分组结果两个视图共用
    const groups = useMemo(() => {
      const g = {};
      CATEGORIES.forEach(c => g[c.key] = []);
      for (const v of videos) {
        const key = getCategoryKey(v.date_uploaded);
        if (g[key]) g[key].push(v);

        // 细粒度分类的视频也归入粗粒度分类，避免"本季度"被"本月/上月"掏空
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

    function noteItem(v) {
      return h('div', {
        key: v.bvid,
        className: 'bili-aux-video-item',
        onClick: () => { if (v.url) window.open(v.url, '_blank'); }
      },
        h('img', { className: 'bili-aux-video-cover', src: v.cover, alt: '', loading: 'lazy' }),
        h('div', { className: 'bili-aux-video-info' },
          h('div', { className: 'bili-aux-video-title', title: v.title }, v.title || v.bvid),
          h('div', { className: 'bili-aux-video-date' }, formatDate(v.date_uploaded)),
          h('div', { className: 'bili-aux-note-text', title: v.note }, v.note || ''),
          h('div', { className: 'bili-aux-note-time' },
            v.note_updated_at ? '备注于 ' + dayjs(v.note_updated_at).format('MM-DD HH:mm') : ''
          )
        )
      );
    }

    return h('div', { className: 'bili-aux-panel' + (isCollapsed ? ' collapsed' : '') },
      // 头部：大类 tabs + 折叠
      h('div', { className: 'bili-aux-panel-header' },
        h('div', { className: 'bili-aux-panel-tabs' },
          h('button', {
            className: 'bili-aux-panel-tab' + (panelMode === 'time' ? ' active' : ''),
            onClick: () => setPanelMode('time')
          }, '发布时间'),
          h('button', {
            className: 'bili-aux-panel-tab' + (panelMode === 'note' ? ' active' : ''),
            onClick: () => setPanelMode('note')
          }, '备注')
        ),
        h('button', {
          className: 'bili-aux-panel-toggle',
          title: '折叠/展开',
          onClick: () => setIsCollapsed(!isCollapsed)
        }, isCollapsed ? '+' : '−')
      ),

      // 内容区
      h('div', { className: 'bili-aux-panel-body' },
        panelMode === 'time'
          ? h('div', { className: 'bili-aux-mode-content' },
              h('div', { className: 'bili-aux-subheader' },
                h('span', { className: 'bili-aux-subheader-title' }, '按发布时间筛选'),
                h('div', { className: 'bili-aux-panel-controls' },
                  h('button', {
                    className: 'bili-aux-view-toggle' + (viewMode === 'list' ? ' active' : ''),
                    title: '列表视图',
                    onClick: () => setViewMode('list')
                  }, '☰'),
                  h('button', {
                    className: 'bili-aux-view-toggle' + (viewMode === 'tab' ? ' active' : ''),
                    title: '面板视图',
                    onClick: () => setViewMode('tab')
                  }, '▦')
                )
              ),
              videos.length === 0
                ? h('div', { className: 'bili-aux-empty' }, '暂无数据，滚动页面加载更多视频')
                : viewMode === 'list'
                  ? categories.map(cat => h('div', {
                      key: cat.key,
                      className: 'bili-aux-category' + (expandedKeys.has(cat.key) ? ' expanded' : ''),
                      'data-key': cat.key
                    },
                      h('div', {
                        className: 'bili-aux-category-header',
                        onClick: () => toggleCategory(cat.key)
                      },
                        h('span', { className: 'bili-aux-category-arrow' }),
                        h('span', { className: 'bili-aux-category-name' }, cat.label),
                        h('span', { className: 'bili-aux-category-count' }, cat.videos.length)
                      ),
                      h('div', { className: 'bili-aux-category-list' },
                        cat.videos.map(videoItem)
                      )
                    ))
                  : h('div', { className: 'bili-aux-tab-view' },
                      h('div', { className: 'bili-aux-tab-bar' },
                        CATEGORIES.map(cat => h('button', {
                          key: cat.key,
                          className: 'bili-aux-tab'
                            + (activeTab === cat.key ? ' active' : '')
                            + (groups[cat.key].length === 0 ? ' empty' : ''),
                          onClick: () => {
                            if (groups[cat.key].length > 0) setActiveTab(cat.key);
                          }
                        },
                          cat.label,
                          h('span', { className: 'bili-aux-tab-count' }, groups[cat.key].length)
                        ))
                      ),
                      h('div', { className: 'bili-aux-tab-content' },
                        activeVideos.length === 0
                          ? h('div', { className: 'bili-aux-empty' }, '该分类暂无视频')
                          : activeVideos.map(videoItem)
                      )
                    )
            )
          : h('div', { className: 'bili-aux-mode-content' },
              h('div', { className: 'bili-aux-subheader' },
                h('span', { className: 'bili-aux-subheader-title' }, '按备注筛选'),
                h('div', { className: 'bili-aux-panel-controls' },
                  h('button', {
                    className: 'bili-aux-view-toggle' + (noteSort === 'desc' ? ' active' : ''),
                    title: '最新优先',
                    onClick: () => setNoteSort('desc')
                  }, '↓'),
                  h('button', {
                    className: 'bili-aux-view-toggle' + (noteSort === 'asc' ? ' active' : ''),
                    title: '最早优先',
                    onClick: () => setNoteSort('asc')
                  }, '↑')
                )
              ),
              sortedNoteVideos.length === 0
                ? h('div', { className: 'bili-aux-empty' }, '暂无备注视频')
                : h('div', { className: 'bili-aux-note-list' },
                    sortedNoteVideos.map(noteItem)
                  )
            )
      )
    );
  }

  let root = null;

  function ensureMounted() {
    if (root) return;
    const el = document.createElement('div');
    el.id = 'bili-aux-panel-mount';
    document.body.appendChild(el);
    root = createRoot(el);
    root.render(h(PanelApp));
  }

  window.BiliAuxPanel = {
    update(videos) {
      ensureMounted();
      if (appRef.setVideos) appRef.setVideos(videos);
    },
    init() {
      ensureMounted();
    },
    reset() {
      if (appRef.reset) appRef.reset();
    },
    refreshNotes() {
      ensureMounted();
      if (appRef.refreshNotes) appRef.refreshNotes();
    }
  };
})();
