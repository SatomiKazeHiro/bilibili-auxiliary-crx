# B站辅助插件 (Bilibili Auxiliary Extension)

## 项目概述

本项目是一个面向 Bilibili（哔哩哔哩）的 Chrome 浏览器扩展（Manifest V3），用于增强 B 站部分页面的使用体验。

**核心功能：**

1. **历史记录页辅助**（`https://www.bilibili.com/history`）
   - 在历史记录每个视频卡片封面左上角叠加显示该视频的上传/发布时间。
   - 在页面右侧提供固定面板，按发布时间将视频分为"今天"、"本周"、"本月"、"上月"、"本季度"、"本年"、"很久以前"、"已失效"等类别，支持列表视图与选项卡视图切换。
   - 为每个视频卡片添加备注图标，点击可打开弹窗编辑备注；备注内容持久化存储，并可在面板的"备注"Tab 中查看全部带备注的视频。
   - 使用浏览器的 IndexedDB 缓存视频元数据（BV号、标题、封面、链接、上传时间、发布时间、标签、备注），避免重复请求 B 站页面。

2. **视频播放页辅助**（`https://www.bilibili.com/video/*`）
   - 检测右侧"视频选集"面板（`.video-pod`）。
   - 若为单列表，在 `.header-top .right` 显示该列表所有视频的总时长。
   - 若存在多个子集（`.pod-slide`），在当前激活的 `.slide-item` 右侧显示该子集下视频的总时长；切换子集时自动重新计算。

## 技术栈

- **扩展规范**：Chrome Extension Manifest V3
- **脚本类型**：Content Script（内容脚本），无 Service Worker / Background Script
- **前端框架**：React 18（通过 UMD 文件直接加载，非构建产物）
- **日期处理**：dayjs（通过 UMD 文件直接加载）
- **数据存储**：浏览器原生 IndexedDB（`src/common/db.js` 做了一层 Promise 封装）
- **样式**：纯 CSS，无预处理器
- **构建工具**：**无**。本项目为零构建工程，所有文件均为可直接在浏览器中运行的原生代码。

## 项目结构

```
.
├── manifest.json              # 扩展清单文件（Manifest V3）
├── assets/
│   ├── icons/
│   │   ├── icon16.png         # 扩展图标（16x16）
│   │   ├── icon48.png         # 扩展图标（48x48）
│   │   └── icon128.png        # 扩展图标（128x128）
│   └── js/
│       ├── dayjs.min.js       # dayjs 库（UMD）
│       └── react@18.3.1/
│           └── umd/
│               ├── react.production.min.js      # React 18 UMD
│               └── react-dom.production.min.js  # ReactDOM 18 UMD
├── src/
│   ├── common/
│   │   └── db.js              # IndexedDB 封装层（全局对象 BiliAuxDB）
│   ├── history/
│   │   ├── content.js         # 历史记录页主内容脚本（入口逻辑）
│   │   ├── panel.js           # 右侧面板：React 组件、时间分类逻辑（全局对象 BiliAuxPanel）
│   │   └── styles.css         # 历史记录页样式：时间标签、面板、弹窗、备注图标等
│   └── video/
│       ├── content.js         # 视频播放页内容脚本：计算选集/子集总时长
│       └── styles.css         # 视频播放页样式：总时长标签、子集时长标签等
└── docs/
    ├── target.md              # 需求文档：历史记录页目标 DOM 结构与开发思路
    └── 260617.1.md            # 需求文档：视频播放页选集总时长需求
```

## 运行与安装方式

本项目**没有构建步骤**，直接以"解压包"形式加载到 Chrome / Edge 中即可：

1. 打开 Chrome，进入 `chrome://extensions/`。
2. 开启右上角"开发者模式"。
3. 点击"加载已解压的扩展程序"。
4. 选择本项目的根目录（包含 `manifest.json` 的文件夹）。
5. 访问 `https://www.bilibili.com/history` 或任意 `https://www.bilibili.com/video/*` 页面，即可看到效果。

**无需 `npm install`、无需打包、无需编译。**

## 代码组织与模块职责

### `manifest.json`

- 定义了两个 `content_scripts`：
  - **历史记录页脚本**：匹配 `https://www.bilibili.com/*`。
    - `js` 数组按顺序注入：`dayjs` → `react` → `react-dom` → `db.js` → `panel.js` → `history/content.js`。
    - `css` 注入 `src/history/styles.css`。
    - `run_at: "document_idle"`。
  - **视频播放页脚本**：匹配 `https://www.bilibili.com/video/*`。
    - `js` 注入 `src/video/content.js`。
    - `css` 注入 `src/video/styles.css`。
    - `run_at: "document_idle"`。
- `permissions` 为空数组，不请求额外权限。
- `host_permissions` 仅包含 `https://www.bilibili.com/*`。
- `icons` 引用了 `assets/icons/` 下的三枚图标。

### `src/common/db.js`

- 数据库名：`bilibili-history-aux`
- 版本：`1`
- 对象存储：`videos`，主键为 `bvid`
- 索引：`uploadDate`、`updatedAt`
- 全局暴露 `window.BiliAuxDB`，提供以下方法：
  - `getVideo(bvid)` — 读取单条视频数据
  - `saveVideo(video)` — 保存/更新视频数据（自动合并已有字段，保留 `note`）
  - `updateNote(bvid, note)` — 更新备注
  - `getAllVideos()` — 读取全部视频
  - `getVideosWithNote()` — 读取所有带备注的视频
  - `batchSave(videos)` — 批量写入

### `src/history/content.js`

- 模块入口为立即执行函数，不主动暴露全局对象，依赖 `window.BiliAuxDB` 和 `window.BiliAuxPanel`。
- **路由监听**：劫持 `history.pushState` / `history.replaceState` 并监听 `popstate`，只在 `/history` 页面激活，离开时清理状态。
- **DOM 监听**：使用 `MutationObserver` 监听 `document.body` 的子树变化，防抖 300ms 后处理新卡片。
- **卡片解析**：从历史记录卡片 DOM 中提取 `bvid`、链接、标题、封面图地址。
- **数据获取**：
  - 优先从 IndexedDB 读取缓存；
  - 缓存未命中时，通过 `fetch` 请求视频详情页 HTML（并发数限制为 3，防止请求过多被封）；
  - 从 HTML 中解析 `<meta itemprop="uploadDate">`、`<meta itemprop="datePublished">` 和 `tags` JSON；
  - 若 `uploadDate` 为空，则标记为失效视频（`isInvalid: true`）。
- **UI 渲染**：
  - 在封面左上角插入 `.upload-date-badge` 显示短日期（同年显示 `MM-DD`，跨年显示 `YYYY-MM-DD`）。
  - 在封面右上角插入 `.note-badge`（✎），点击打开模态框编辑备注；已存在备注时高亮并显示备注浮层。
- **数据源同步**：将当前页面已解析的视频维护在内存对象 `pageVideos` 中，作为右侧面板的唯一数据源。

### `src/history/panel.js`

- React 18 组件，全局暴露 `window.BiliAuxPanel`。
- 通过 `createRoot` 将面板挂载到页面 body 末尾的 `div#bili-aux-panel-mount` 中。
- 面板支持两种模式：
  - **发布时间**：按 `getCategoryKey` 逻辑分组，支持"列表视图"（可折叠分类）和"选项卡视图"。
  - **备注**：展示所有带备注的视频，支持按更新时间正/倒序排列。
- 分类逻辑（基于 `dayjs`）：
  - `today` — 同一天
  - `thisWeek` — 本周（周一至周日）
  - `thisMonth` — 同月
  - `lastMonth` — 上月
  - `thisQuarter` — 本季度（3个月为一段）
  - `thisYear` — 同年
  - `longAgo` — 更早
  - `invalid` — 无上传日期（视频失效）
- 粗粒度分类会包含细粒度分类中的视频（如"本季度"包含"本月"、"上月"的视频），避免上层分类被掏空。

### `src/history/styles.css`

- 全部 UI 样式集中在一个文件中。
- 命名空间统一使用 `bili-aux-` 前缀，避免与 B 站原有样式冲突。
- B 站品牌色为 `#fb7299`（粉色），面板头部、激活态、有备注的图标等均采用该颜色。
- 包含：时间标签、右侧面板、分类列表、视频项、选项卡、空状态、备注图标、备注弹窗、滚动条美化等样式。

### `src/video/content.js`

- 立即执行函数，无全局对象暴露，仅在 `https://www.bilibili.com/video/*` 页面执行。
- **延迟启动**：页面加载 6 秒后（`START_DELAY = 6000`）开始查找 `.video-pod`，并在随后 12 秒内每秒轮询一次，以兼容 Vue 等框架的二次渲染。
- **单列表场景**：在 `.header-top .right` 渲染 `.bili-aux-total-duration`，文本形如 `总时长 12:34`。
- **多子集场景**：检测 `.pod-slide` 存在时，在当前 `.slide-item.active` 右侧渲染 `.bili-aux-slide-duration`，文本形如 ` (12:34)`。
- **子集切换监听**：页面加载约 10 秒后，对 `.slide-inner` 的 `style` 属性做 `MutationObserver`；当 `left` 变化且当前激活子集尚未挂载时长标签时，重新计算。
- **时长解析**：从 `.stat-item.duration` 文本中提取 `HH:MM:SS` / `MM:SS` / `SS` 并累加。

### `src/video/styles.css`

- 调整 `.video-pod .slide-inner .slide-item` 的 `max-width` 为 `unset`，避免子集标题被截断。
- 定义 `.bili-aux-total-duration` 标签样式，使用 B 站品牌蓝色变量 `--brand_blue`。
- 定义 `.bili-aux-slide-duration` 子集时长标签样式。

## 开发规范与注意事项

### 代码风格

- 使用原生 ES5/ES6 IIFE 模式组织模块，未使用 ES Module 或任何模块化规范。
- 变量命名采用 camelCase；CSS 类名采用 kebab-case，且统一加 `bili-aux-` 前缀。
- 日志统一使用 `[BiliAux]` 前缀，便于在控制台过滤。
- 代码注释使用中文。

### DOM 操作规范

- 对历史记录卡片进行处理前，先检查 `dataset.biliAuxProcessed === '1'`，防止重复处理。
- 为已处理卡片设置 `data-bili-aux-bvid` 属性，便于后续根据 bvid 反查卡片更新 UI。
- 使用 `getComputedStyle` 检查父级 `position` 是否为 `static`，必要时设置为 `relative`，确保绝对定位的子元素（badge）正确显示。
- 视频页脚本使用 `data-bili-aux-duration-processed` 标记已处理过的 `.video-pod`，防止重复初始化。

### 网络请求规范

- 视频详情页请求使用 `credentials: 'omit'`，不携带 Cookie，降低被风控概率。
- 并发请求数限制为 `3`（`CONCURRENCY = 3`），缺失数据分批串行处理。
- 请求失败（HTTP 异常或解析失败）时仅打印 `console.warn`，不阻断后续流程。

### 数据持久化规范

- `saveVideo` 采用"合并写入"策略：新数据与数据库已有数据做对象展开合并，保留 `note` 等用户自定义字段，避免覆盖丢失。
- `updatedAt` 使用 `Date.now()` 时间戳，用于备注列表的排序。

### 视频页兼容性

- `.video-pod` 依赖 Vue 渲染时机，因此采用 6 秒延迟 + 12 秒轮询的兜底策略。
- 多子集切换依赖 `.slide-inner` 的 `style.left` 变化，若 B 站 DOM 结构调整可能导致监听失效。

## 测试策略

本项目**当前没有自动化测试**。由于它是直接操作特定第三方网站 DOM 的浏览器扩展，常规单元测试较难覆盖核心逻辑。如需补充测试，建议关注以下方向：

1. **时间分类逻辑测试** — `getCategoryKey` 和 `formatDate` 是纯函数，可独立抽离并用 Node.js 简单脚本验证。
2. **时长解析/格式化测试** — `parseDuration` 和 `formatDuration` 是纯函数，可离线测试。
3. **IndexedDB 操作测试** — 可在支持 IndexedDB 的浏览器环境（如 Playwright）中对 `db.js` 的 CRUD 做集成测试。
4. **DOM 解析测试** — 保存 B 站历史记录页面和视频播放页的真实 HTML 片段，对 `parseCard`、`parseVideoPage`、以及视频选集结构做离线回归测试。

## 安全与隐私考量

- 扩展仅请求 `https://www.bilibili.com/*` 的 `host_permissions`，无其他跨域权限。
- `permissions` 为空数组，不请求 storage、tabs 等额外权限。
- 所有数据（视频元数据、备注）均存储在用户本地浏览器的 IndexedDB 中，不上传到任何服务器。
- 抓取视频详情页时未携带 Cookie，不利用用户登录态做额外操作。

## 扩展与维护建议

- **新增页面辅助功能**：如需增加其他 B 站页面的辅助功能（如收藏夹、搜索页），建议新增 `src/<feature>/` 目录，并在 `manifest.json` 的 `content_scripts` 中按页面路径拆分 `matches` 和 `js/css`，避免全部脚本堆在一个入口。
- **依赖升级**：React / dayjs 目前为本地静态文件，升级时直接替换 `assets/js` 中的文件即可，注意检查 UMD 全局变量名（`React`、`ReactDOM`、`dayjs`）是否变化。
- **性能优化**：若历史记录页面视频量极大，`pageVideos` 内存对象和 `SEEN_BVIDS` Set 会持续增长，离开 `/history` 页面时会自动清空；长时间停留可考虑过期的 LRU 清理策略。
