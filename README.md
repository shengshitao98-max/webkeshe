# 短视频审核管理系统

一个 AI 辅助 + 人工复审的短视频内容审核平台，支持自动内容识别、风险分级和人工复审流程。

## 系统架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   前端应用  │────→│  后端服务    │────→│  AI服务     │
│  (React)    │     │  (Express)   │     │  (Python)   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   数据库      │
                    │ (SQLite/PG)  │
                    └──────────────┘
```

## 项目结构

```
webkeshe/
├── backend/              # 后端 Express 服务
│   ├── src/
│   │   ├── api/         # API 路由
│   │   ├── controllers/ # 控制器
│   │   ├── services/    # 业务逻辑
│   │   ├── models/      # 数据模型
│   │   ├── middleware/  # 中间件
│   │   ├── utils/       # 工具函数
│   │   └── app.js       # 主应用文件
│   ├── uploads/         # 文件上传目录
│   ├── package.json
│   └── .env
├── frontend/             # 前端 React 应用
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   ├── components/  # 通用组件
│   │   ├── hooks/       # 自定义 Hook
│   │   ├── services/    # API 服务
│   │   ├── styles/      # 样式文件
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── ai-service/          # AI 服务（Python）
│   ├── app.py           # Flask 应用
│   ├── models/          # AI 模型
│   ├── processors/      # 视频处理器
│   ├── classifiers/     # 分类器
│   └── requirements.txt
├── config/              # 配置文件
│   ├── db.config.js
│   ├── ai.config.js
│   └── app.config.js
├── docs/                # 文档
│   ├── API.md
│   ├── DB_SCHEMA.md
│   └── DEPLOYMENT.md
└── docker-compose.yml   # Docker 编排
```

## 核心功能模块

### 1. 视频上传与预处理
- 视频上传、验证、存储
- 元数据提取（时长、分辨率等）
- 关键帧抽取（5 秒间隔）
- 音频提取与语音识别

### 2. 自动分类（可选加分项）
- 基于视频内容的一级分类
- 支持至少 3 种分类类别
- 用于后续审核策略定制

### 3. AI 内容识别（核心）
- 敏感词检测
- 图像内容过滤
- 综合风险判定（通过/可疑/违规）

### 4. 人工复审流程
- 审核任务列表
- 审核详情展示
- 复审操作与意见记录
- 审核日志记录

### 5. 统计看板
- 上传量统计
- 审核通过率
- 违规类型占比

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS + Vite |
| 后端 | Node.js + Express.js + SQLite/PostgreSQL |
| AI | Python + Flask + OpenCV + TensorFlow |
| 部署 | Docker + Docker Compose |

## 快速开始

### 后端

```bash
cd backend
npm install
npm run dev
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

### AI 服务

```bash
cd ai-service
pip install -r requirements.txt
python app.py
```

## API 文档

详见 [docs/API.md](docs/API.md)

## 数据库

详见 [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md)

## 部署

详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
