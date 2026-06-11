# 快速开始指南

## 项目概述

这是一个短视频 AI 审核 + 人工复审系统，包含：
- 视频上传与预处理
- AI 内容自动识别（敏感词、图像分类）
- 人工复审工作流
- 审核统计看板

## 系统要求

- **Node.js**: 18.0 或更高版本
- **Python**: 3.11 或更高版本
- **FFmpeg**: 用于视频处理
- **Docker**: 可选，用于容器化部署

## 一键启动（使用 npm）

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install

# AI 服务
cd ../ai-service
pip install -r requirements.txt
```

### 2. 启动服务

打开三个终端窗口：

**终端 1 - 后端**
```bash
cd backend
npm run dev
# 运行在 http://localhost:3000
```

**终端 2 - 前端**
```bash
cd frontend
npm run dev
# 运行在 http://localhost:5173
```

**终端 3 - AI 服务**
```bash
cd ai-service
python app.py
# 运行在 http://localhost:5000
```

### 3. 访问应用

打开浏览器访问: **http://localhost:5173**

演示账号：
- 用户名: `reviewer1`
- 密码: 任意

## 使用 Docker Compose 启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

然后访问: **http://localhost:5173**

## 核心功能使用

### 1. 上传视频

1. 登录系统
2. 点击左侧菜单 "上传视频"
3. 选择视频文件（MP4/MOV/AVI，最大 200MB）
4. 填写标题、描述、分类
5. 点击"上传视频"

系统会自动进行 AI 分析：
- 关键帧抽取
- 音频转写
- 敏感词检测
- 图像分类

### 2. 人工复审

1. 点击左侧菜单 "待复审"
2. 查看风险等级为 "可疑" 或 "违规" 的视频
3. 点击 "查看详情"
4. 审核 AI 分析结果（敏感词、分数等）
5. 选择最终决定（通过/违规/待申诉）
6. 填写审核意见（必填）
7. 提交复审

系统会自动记录：
- 复审人、时间
- AI 判定 vs 人工判定对比
- 审核意见

### 3. 查看统计

1. 点击左侧菜单 "统计看板"
2. 查看统计指标：
   - 今日上传、处理、复审数量
   - AI 通过率
   - 人工复审通过率
   - 风险分布（通过/可疑/违规）
   - 视频分类分布
   - 敏感词排名

## 项目结构

```
webkeshe/
├── backend/              # Express 后端服务
│   ├── src/
│   │   ├── api/         # API 路由
│   │   ├── controllers/ # 请求处理器
│   │   ├── services/    # 业务逻辑
│   │   ├── models/      # 数据模型
│   │   ├── middleware/  # 中间件
│   │   ├── utils/       # 工具函数
│   │   └── app.js       # 主应用
│   ├── uploads/         # 视频存储
│   ├── data/            # SQLite 数据库
│   └── package.json
│
├── frontend/             # React 前端应用
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   ├── components/  # UI 组件
│   │   ├── services/    # API 调用
│   │   ├── stores/      # 状态管理
│   │   └── styles/      # 样式文件
│   └── package.json
│
├── ai-service/          # Python AI 服务
│   ├── app.py           # Flask 主应用
│   ├── processors/      # 视频处理器
│   ├── classifiers/     # 图像分类器
│   └── requirements.txt
│
├── docs/                # 文档
│   ├── API.md          # API 文档
│   ├── DB_SCHEMA.md    # 数据库设计
│   └── DEPLOYMENT.md   # 部署指南
│
└── docker-compose.yml   # Docker 编排
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 后端 | Express.js + SQLite + Sequelize |
| AI | Flask + OpenCV + TensorFlow |
| 部署 | Docker + Docker Compose |

## 主要功能实现

### 视频上传
- ✅ 文件大小验证（≤200MB）
- ✅ 格式验证（MP4/MOV/AVI）
- ✅ 异步处理
- ✅ 进度显示

### AI 内容识别
- ✅ 敏感词检测（政治、色情、暴力、违法）
- ✅ 图像分类（正常、色情、暴力）
- ✅ 音频转文字
- ✅ 关键帧抽取
- ✅ 综合风险评分（0-100）

### 人工复审
- ✅ 待复审列表
- ✅ 详情查看
- ✅ 复审决定（通过/违规/申诉）
- ✅ 必填意见
- ✅ 审核日志

### 统计看板
- ✅ 每日数据统计
- ✅ 总体统计
- ✅ 分类分布
- ✅ 敏感词排名

## 常见问题

### Q: 如何修改敏感词？
A: 编辑 `ai-service/processors/keyword_detector.py`，修改 `keywords_db` 字典。

### Q: 如何添加新的分类？
A: 在 `backend/src/models/Video.js` 中修改 `category` 字段的 ENUM 值。

### Q: 如何自定义风险评分规则？
A: 修改 `backend/src/utils/helpers.js` 中的 `calculateOverallRiskScore` 函数。

### Q: 如何使用真实的语音识别？
A: 在 `ai-service/processors/video_processor.py` 中集成：
- Google Speech-to-Text API
- Azure Speech Service
- OpenAI Whisper
- 本地 DeepSpeech

### Q: 如何使用真实的图像分类模型？
A: 在 `ai-service/classifiers/image_classifier.py` 中集成：
- TensorFlow/PyTorch 预训练模型
- 第三方 API（如阿里云内容识别）

## API 测试

```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"reviewer1","password":"pass"}'

# 获取健康检查
curl http://localhost:3000/api/health
curl http://localhost:5000/api/health
```

详见 [docs/API.md](docs/API.md)

## 数据库

系统默认使用 SQLite，数据存储在 `backend/data/database.sqlite`

生产环境建议使用 PostgreSQL，参考 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 支持和反馈

遇到问题？检查：
1. 所有三个服务是否正常运行
2. 环境变量是否正确配置
3. 依赖是否安装完整
4. 端口是否被占用

## 许可证

MIT
