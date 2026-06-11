# 部署指南

## 前置条件

- Docker & Docker Compose
- Node.js 18+ (本地开发)
- Python 3.11+ (本地开发)
- FFmpeg

## 本地开发

### 1. 后端设置

```bash
cd backend
npm install
npm run dev
```

服务器运行在 `http://localhost:3000`

### 2. 前端设置

```bash
cd frontend
npm install
npm run dev
```

应用运行在 `http://localhost:5173`

### 3. AI 服务设置

```bash
cd ai-service
pip install -r requirements.txt
python app.py
```

AI 服务运行在 `http://localhost:5000`

## Docker Compose 部署

### 快速启动

```bash
# 构建所有镜像
docker-compose build

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:3000
- AI 服务: http://localhost:5000

## 生产部署

### 1. 环境配置

创建生产环境配置文件:

```bash
# backend/.env.production
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@db:5432/video_audit
AI_SERVICE_URL=http://ai-service:5000
JWT_SECRET=your-secure-secret-key-min-32-chars
MAX_FILE_SIZE=209715200
LOG_LEVEL=info
```

### 2. 使用 SSL/TLS

```bash
# 创建自签名证书（开发）
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# 或使用 Let's Encrypt
certbot certonly --standalone -d yourdomain.com
```

### 3. Nginx 反向代理配置

```nginx
upstream backend {
    server localhost:3000;
}

upstream frontend {
    server localhost:5173;
}

server {
    listen 80;
    server_name yourdomain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # API 代理
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 前端
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. 使用 PostgreSQL

```bash
# 启动 PostgreSQL
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=video_audit \
  -p 5432:5432 \
  postgres:15

# 更新 backend/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/video_audit
```

### 5. 监控和日志

```bash
# 使用 PM2 管理进程
npm install -g pm2

# 启动后端
cd backend
pm2 start app.js --name "backend"

# 查看日志
pm2 logs backend

# 监控
pm2 monit
```

### 6. 备份数据库

```bash
# 备份
docker exec postgres pg_dump -U postgres video_audit > backup.sql

# 恢复
docker exec -i postgres psql -U postgres video_audit < backup.sql
```

## 性能优化

### 1. 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_uploadedAt ON videos(uploadedAt);
CREATE INDEX idx_reviews_reviewedAt ON reviews(reviewedAt);

-- 分析查询性能
EXPLAIN ANALYZE SELECT * FROM videos WHERE status = 'pending';
```

### 2. 缓存策略

- 使用 Redis 缓存热数据
- 前端使用浏览器缓存
- 实现 API 响应缓存

### 3. 文件存储

- 考虑使用对象存储（S3、阿里云 OSS）
- 实现 CDN 加速
- 定期清理临时文件

## 安全配置

### 1. 认证和授权

```javascript
// 使用 HTTPS only
app.use(helmet());

// 速率限制
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);
```

### 2. 数据加密

```javascript
// 密码哈希
const bcrypt = require('bcryptjs');
const hashed = await bcrypt.hash(password, 10);

// JWT 签名
jwt.sign(payload, process.env.JWT_SECRET);
```

### 3. CORS 配置

```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true
}));
```

## 故障排除

### 问题: 无法连接到 AI 服务

```bash
# 检查 AI 服务状态
curl http://localhost:5000/api/health

# 查看日志
docker logs video-audit_ai-service_1
```

### 问题: 数据库连接错误

```bash
# 检查连接字符串
echo $DATABASE_URL

# 测试数据库连接
psql $DATABASE_URL -c "SELECT 1"
```

### 问题: 上传文件失败

```bash
# 检查上传目录权限
ls -la backend/uploads/

# 调整权限
chmod 755 backend/uploads/
```

## 检查清单

- [ ] 配置环境变量
- [ ] 创建数据库
- [ ] 设置 SSL 证书
- [ ] 配置反向代理
- [ ] 设置备份策略
- [ ] 配置监控告警
- [ ] 测试 API 端点
- [ ] 压力测试
- [ ] 安全审计
