# API 文档

## 基础信息

- Base URL: `http://localhost:3000/api`
- 认证: JWT Token (在 Authorization header 中)
- 内容类型: `application/json`

## 认证端点

### 登录
```
POST /auth/login
Content-Type: application/json

{
  "username": "reviewer1",
  "password": "password"
}

Response 200:
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "username": "reviewer1",
    "role": "reviewer"
  }
}
```

## 视频端点

### 上传视频
```
POST /videos/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

Files:
  video: <video file>

Form Data:
  title: string
  description: string
  category: 'news' | 'entertainment' | 'education' | 'lifestyle' | 'other'

Response 201:
{
  "message": "Video uploaded successfully",
  "video": {
    "id": "uuid",
    "filename": "string",
    "originalName": "string",
    "fileSize": number,
    "title": "string",
    "description": "string",
    "category": "string",
    "uploaderId": "uuid",
    "status": "pending"
  }
}
```

### 获取视频列表
```
GET /videos?status=pending&limit=20&offset=0
Authorization: Bearer <token>

Query Parameters:
  status: 'pending' | 'processing' | 'completed' | 'failed'
  limit: number (default: 20)
  offset: number (default: 0)

Response 200:
{
  "total": number,
  "videos": [...]
}
```

### 获取视频详情
```
GET /videos/:videoId
Authorization: Bearer <token>

Response 200:
{
  "id": "uuid",
  "filename": "string",
  "title": "string",
  ...
}
```

### 获取分析结果
```
GET /videos/:videoId/analysis
Authorization: Bearer <token>

Response 200:
{
  "id": "uuid",
  "videoId": "uuid",
  "textRiskScore": number,
  "imageRiskScore": number,
  "overallRiskScore": number,
  "riskLevel": 'pass' | 'suspicious' | 'violation',
  "sensitiveKeywords": [string],
  "keyframes": [string],
  "transcription": "string",
  "imageClassifications": [...]
}
```

## 复审端点

### 获取待复审列表
```
GET /reviews/pending?limit=20&offset=0&riskLevel=suspicious
Authorization: Bearer <token>
Role: reviewer, admin

Query Parameters:
  limit: number
  offset: number
  riskLevel: 'suspicious' | 'violation' (optional)

Response 200:
{
  "total": number,
  "pendingReviews": [...]
}
```

### 提交复审
```
POST /reviews
Authorization: Bearer <token>
Content-Type: application/json
Role: reviewer, admin

{
  "videoId": "uuid",
  "auditResultId": "uuid",
  "finalDecision": "pass" | "violation" | "appeal_pending",
  "reviewComment": "string (required, min 10 chars)"
}

Response 201:
{
  "message": "Review submitted successfully",
  "review": {...}
}
```

### 更新复审
```
PUT /reviews/:reviewId
Authorization: Bearer <token>
Content-Type: application/json
Role: reviewer, admin

{
  "finalDecision": "pass" | "violation" | "appeal_pending",
  "reviewComment": "string"
}

Response 200:
{
  "message": "Review updated successfully",
  "review": {...}
}
```

### 获取复审历史
```
GET /reviews/:videoId/history
Authorization: Bearer <token>

Response 200:
[
  {
    "id": "uuid",
    "videoId": "uuid",
    "reviewerId": "uuid",
    "finalDecision": "string",
    "reviewComment": "string",
    "reviewedAt": "ISO 8601 date"
  }
]
```

### 获取审核日志
```
GET /reviews/:videoId/log
Authorization: Bearer <token>

Response 200:
[
  {
    "id": "uuid",
    "videoId": "uuid",
    "operatorId": "uuid",
    "operationType": "created" | "updated" | "deleted",
    "statusBefore": "string",
    "statusAfter": "string",
    "operatedAt": "ISO 8601 date"
  }
]
```

## 统计端点

### 获取每日统计
```
GET /statistics/daily?date=2024-01-01
Authorization: Bearer <token>
Role: reviewer, admin

Query Parameters:
  date: ISO 8601 date (optional, default: today)

Response 200:
{
  "date": "2024-01-01",
  "uploadCount": number,
  "processedCount": number,
  "reviewCount": number,
  "riskLevelDistribution": {
    "pass": number,
    "suspicious": number,
    "violation": number
  },
  "reviewDecisions": {
    "pass": number,
    "violation": number,
    "appeal_pending": number
  },
  "aiPassRate": number,
  "reviewPassRate": number
}
```

### 获取总体统计
```
GET /statistics/overall
Authorization: Bearer <token>
Role: admin

Response 200:
{
  "totalUploads": number,
  "totalProcessed": number,
  "totalReviews": number,
  "riskLevelDistribution": {...},
  "reviewDecisions": {...}
}
```

### 获取分类统计
```
GET /statistics/category
Authorization: Bearer <token>
Role: admin

Response 200:
{
  "news": number,
  "entertainment": number,
  "education": number,
  "lifestyle": number,
  "other": number
}
```

### 获取敏感词统计
```
GET /statistics/keywords
Authorization: Bearer <token>
Role: admin

Response 200:
{
  "keyword1": number,
  "keyword2": number,
  ...
}
```

## 错误处理

所有端点都可能返回以下错误:

```json
400 Bad Request
{
  "error": "Invalid request parameters"
}

401 Unauthorized
{
  "error": "No token provided" | "Invalid token"
}

403 Forbidden
{
  "error": "Insufficient permissions"
}

404 Not Found
{
  "error": "Resource not found"
}

500 Internal Server Error
{
  "error": "Internal server error"
}
```
