# B站辅助插件 - 智能体开发指南

## 项目概述

Chrome Extension（Manifest V3），用于增强 Bilibili 网页体验。当前核心功能：

- **历史记录页辅助** (`https://www.bilibili.com/history`)
  - 为每个历史视频卡片显示上传/发布时间 badge
  - 右侧面板按时间维度（今天/本周/本月/上月/本季度/本年/很久以前）筛选视频
  - 视频备注：点击卡片备注图标编辑，本地 IndexedDB + 远端 Supabase 双写
- **视频播放页辅助** (`https://www.bilibili.com/video/*`)
  - 计算并显示选集总时长；多子集时显示当前子集时长

## 技术栈

- **扩展框架**：Chrome Extension Manifest V3，纯 Content Script，无 Service Worker
- **运行时依赖**：
  - React 18 + ReactDOM（UMD，v18.3.1）
  - dayjs（UMD）
  - Supabase JS v2（UMD）
  - 原生 DOM API、Fetch API、IndexedDB
- **本地开发**：Vite（即将接入，用于构建、HMR、ES Modules 拆分）
- **后端**：Supabase（表 `MyBilibiliHistory`）

## 目录结构

```
├── assets/                 # 静态资源（开发阶段占位，图标已迁移到 public）
├── docs/                   # 需求/设计文档
├── public/                 # 不需要构建直接复制的静态资源
│   └── assets/
│       └── icons/          # 扩展图标
│   └── target.md
├── src/
│   ├── common/             # 跨页面复用模块
│   │   ├── config.js       # 配置入口（敏感信息从环境/配置文件注入）
│   │   ├── db.js           # IndexedDB 封装（videos + notes）
│   │   └── supabase.js     # Supabase 客户端封装
│   ├── history/            # 历史记录页功能
│   │   ├── content.js      # 主入口：DOM 监听、卡片解析、数据调度
│   │   ├── panel.js        # React 右侧面板
│   │   └── styles.css      # 历史页样式
│   └── video/              # 视频播放页功能
│       ├── content.js      # 选集总时长计算
│       └── styles.css      # 视频页样式
├── manifest.json           # Chrome 扩展清单
├── README.md               # 项目说明（GitHub 风格）
└── AGENTS.md               # 本文件
```

## 开发约定

### 1. 不写入敏感信息

- Supabase URL、anon key、表名等**不得**硬编码在 README / AGENTS.md / 源码中
- 生产配置通过项目根目录 `.env` 文件注入，Vite 构建时替换为 `import.meta.env`
- 代码中仅使用 `src/common/config/index.js` 暴露的配置对象
- `.env` 已加入 `.gitignore`，禁止提交

### 2. 字段命名

本地对象字段与 Supabase 表字段保持 snake_case 一致：

- `bvid`（主键）
- `title`、`url`、`cover`
- `note`
- `tags`
- `is_invalid`
- `date_published`
- `date_uploaded`
- `note_updated_at`
- `created_at`、`updated_at`

### 3. IndexedDB

- 数据库名：`bili-aux-history-v2`
- 版本：2
- 对象存储：
  - `videos`：所有抓取过的视频元数据
  - `notes`：带备注的视频（含完整字段，用于同步 Supabase）

### 4. Supabase 同步策略

- **读取**：启动时从 Supabase 拉取带备注的视频，覆盖本地 `notes` 存储
- **写入备注**：本地保存后同步 upsert 到 Supabase
- **手动上传**：`BiliAuxUploadLocal()` 合并 `videos` + `notes` 后批量 upsert
- **RLS**：Supabase 表 `MyBilibiliHistory` 必须关闭 RLS，否则 anon key 无法写入

### 5. 内容脚本开发

- 使用 IIFE 避免污染页面全局作用域
- 依赖通过 `window.Xxx` 共享（如 `window.BiliAuxDB`、`window.BiliAuxPanel`）
- DOM 操作前务必确认元素存在，避免 B 站动态渲染导致报错
- 网络请求使用 `AbortController` + 超时，防止单个请求阻塞队列

## 本地加载测试

1. 构建扩展（接入 Vite 后）：
   ```bash
   npm install
   npm run build
   ```
2. Chrome 地址栏打开 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目根目录（或 `dist/` 目录）
5. 访问 `https://www.bilibili.com/history` 测试

## 常见问题

- **多标签页 IndexedDB blocked**：Chrome 同 origin 多内容脚本连接可能触发 blocked，已添加 `beforeunload` 主动关闭连接 + 内存 fallback
- **快速滚动后日期不挂载**：历史页采用 fetch 队列解耦扫描与请求，提高并发，避免前面请求阻塞后面卡片
- **数据丢失**：IndexedDB 版本升级会清空旧数据，重要数据请通过 `BiliAuxUploadLocal()` 同步到 Supabase
