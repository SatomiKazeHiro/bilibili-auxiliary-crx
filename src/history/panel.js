/**
 * 右侧面板逻辑：时间分类、渲染、交互
 * React 18 + dayjs
 * 支持列表视图 / 选项卡面板视图切换
 */
(function () {
  'use strict';

  const h = React.createElement;
  const { useState, useMemo } = React;
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
        h('div', { className: 'bili-aux-video-date' }, formatDate(v.uploadDate))
      )
    );
  }

  // 外部通过此 ref 操作 React 状态
  const appRef = { setVideos: null, reset: null };

  function PanelApp() {
    const [videos, setVideos] = useState([]);
    const [expandedKeys, setExpandedKeys] = useState(new Set(['thisMonth']));
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'tab'
    const [activeTab, setActiveTab] = useState('thisMonth');

    // 暴露 setter 给外部
    appRef.setVideos = setVideos;
    appRef.reset = () => {
      setVideos([]);
      setExpandedKeys(new Set(['thisMonth']));
      setActiveTab('thisMonth');
      setViewMode('list');
    };

    // 分组结果两个视图共用
    const groups = useMemo(() => {
      const g = {};
      CATEGORIES.forEach(c => g[c.key] = []);
      for (const v of videos) {
        const key = getCategoryKey(v.uploadDate);
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

    function toggleCategory(key) {
      setExpandedKeys(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }

    return h('div', { className: 'bili-aux-panel' + (isCollapsed ? ' collapsed' : '') },
      // 头部
      h('div', { className: 'bili-aux-panel-header' },
        h('span', { className: 'bili-aux-panel-title' }, '按发布时间筛选'),
        h('div', { className: 'bili-aux-panel-controls' },
          // 列表视图
          h('button', {
            className: 'bili-aux-view-toggle' + (viewMode === 'list' ? ' active' : ''),
            title: '列表视图',
            onClick: () => setViewMode('list')
          }, '☰'),
          // 面板视图
          h('button', {
            className: 'bili-aux-view-toggle' + (viewMode === 'tab' ? ' active' : ''),
            title: '面板视图',
            onClick: () => setViewMode('tab')
          }, '▦'),
          // 折叠
          h('button', {
            className: 'bili-aux-panel-toggle',
            title: '折叠/展开',
            onClick: () => setIsCollapsed(!isCollapsed)
          }, isCollapsed ? '+' : '−')
        )
      ),

      // 内容区
      h('div', { className: 'bili-aux-panel-body' },
        videos.length === 0
          ? h('div', { className: 'bili-aux-empty' }, '暂无数据，滚动页面加载更多视频')
          : viewMode === 'list'
            // 列表视图
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
            // 面板视图（选项卡）
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
    }
  };
})();
