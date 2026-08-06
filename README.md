# B站辅助插件

一个用于增强 Bilibili 网页体验的 Chrome 扩展。

## 功能

### 历史记录页

在 `https://www.bilibili.com/history` 页面生效：

- **上传时间 badge**：每个视频卡片左上角显示上传/发布时间
- **时间筛选面板**：页面右侧新增面板，按时间维度筛选当前已加载的视频
  - 今天 / 本周 / 本月 / 上月 / 本季度 / 本年 / 很久以前 / 已失效
- **视频备注**：点击卡片左下角备注图标，可为视频添加备注，数据同步到 Supabase

### 视频播放页

在 `https://www.bilibili.com/video/*` 页面生效：

- **选集总时长**：在视频选集区域显示当前列表的总时长
- **多子集时长**：多子集视频切换时，显示当前子集的时长

## 安装

1. 克隆仓库
2. 安装依赖并构建（接入 Vite 后）：
   ```bash
   npm install
   npm run build
   ```
3. Chrome 打开 `chrome://extensions/`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」，选择构建输出目录

## 配置

扩展需要 Supabase 作为远端存储，用于同步视频备注。

1. 复制 `.env.example` 为 `.env`：
   ```bash
   cp .env.example .env
   ```
2. 在 `.env` 中填入你的 Supabase 信息：
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_SUPABASE_TABLE_NAME=MyBilibiliHistory
   ```
3. 确保 Supabase 中已创建对应表，并关闭 RLS。

> `.env` 已加入 `.gitignore`，不会提交。

## 开发

```bash
# 安装依赖
npm install

# 开发模式（带 HMR）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint
```

## 项目结构

```
├── assets/              # 静态资源与第三方 UMD 脚本
├── docs/                # 需求文档
├── src/
│   ├── common/          # 通用模块（配置、IndexedDB、Supabase）
│   ├── history/         # 历史记录页功能
│   └── video/           # 视频播放页功能
├── manifest.json        # 扩展清单
├── AGENTS.md            # AI 开发指南
└── README.md            # 本文件
```

## 技术栈

- Chrome Extension Manifest V3
- React 18
- dayjs
- Supabase JS v2
- Vite

## 注意事项

- 本扩展仅注入 Content Script，不运行后台 Service Worker
- IndexedDB 用于本地缓存，清理浏览器数据会导致缓存丢失
- 重要数据请通过控制台命令 `BiliAuxUploadLocal()` 上传到 Supabase
# bilibili-auxiliary-crx
