# 数据库模式

## 表结构

### users
存储系统用户信息（上传者、审核员、管理员）

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  role ENUM('admin', 'reviewer', 'uploader') DEFAULT 'uploader',
  status ENUM('active', 'inactive') DEFAULT 'active',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### videos
存储视频基本信息

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  filename VARCHAR NOT NULL,
  originalName VARCHAR NOT NULL,
  fileSize BIGINT NOT NULL,
  duration FLOAT,
  resolution VARCHAR,
  filePath VARCHAR NOT NULL,
  uploaderId UUID NOT NULL REFERENCES users(id),
  title VARCHAR,
  description TEXT,
  category ENUM('news', 'entertainment', 'education', 'lifestyle', 'other') DEFAULT 'other',
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaderId) REFERENCES users(id)
);
```

### audit_results
存储 AI 自动审核结果

```sql
CREATE TABLE audit_results (
  id UUID PRIMARY KEY,
  videoId UUID NOT NULL UNIQUE REFERENCES videos(id),
  textRiskScore FLOAT DEFAULT 0,
  imageRiskScore FLOAT DEFAULT 0,
  overallRiskScore FLOAT DEFAULT 0,
  riskLevel ENUM('pass', 'suspicious', 'violation'),
  sensitiveKeywords JSON,
  keyframes JSON,
  transcription TEXT,
  imageClassifications JSON,
  processedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### reviews
存储人工复审结果

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  videoId UUID NOT NULL REFERENCES videos(id),
  auditResultId UUID NOT NULL REFERENCES audit_results(id),
  reviewerId UUID NOT NULL REFERENCES users(id),
  originalRiskLevel ENUM('pass', 'suspicious', 'violation'),
  finalDecision ENUM('pass', 'violation', 'appeal_pending') NOT NULL,
  reviewComment TEXT NOT NULL,
  reviewedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### audit_logs
存储审核操作日志（不可篡改）

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  videoId UUID NOT NULL REFERENCES videos(id),
  reviewId UUID NOT NULL REFERENCES reviews(id),
  operatorId UUID NOT NULL REFERENCES users(id),
  operationType ENUM('created', 'updated', 'deleted') NOT NULL,
  statusBefore VARCHAR,
  statusAfter VARCHAR,
  changeSummary TEXT,
  operatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (videoId) REFERENCES videos(id),
  FOREIGN KEY (reviewId) REFERENCES reviews(id),
  FOREIGN KEY (operatorId) REFERENCES users(id)
);
```

### sensitive_keywords
存储敏感词库

```sql
CREATE TABLE sensitive_keywords (
  id UUID PRIMARY KEY,
  keyword VARCHAR UNIQUE NOT NULL,
  category ENUM('political', 'porn', 'violence', 'illegal') NOT NULL,
  severity INTEGER DEFAULT 5,
  riskScore FLOAT DEFAULT 10,
  enabled BOOLEAN DEFAULT true,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 关系图

```
users
├── uploadedVideos (1:N) → videos
├── reviews (1:N) → reviews (as reviewer)
└── auditLogs (1:N) → auditLogs (as operator)

videos
├── auditResult (1:1) → audit_results
├── reviews (1:N) → reviews
└── auditLogs (1:N) → auditLogs

audit_results
├── video (1:1) → videos
└── reviews (1:N) → reviews

reviews
├── video (1:N) → videos
├── auditResult (1:N) → audit_results
├── reviewer (N:1) → users
└── auditLogs (1:N) → auditLogs

audit_logs
├── video (N:1) → videos
├── review (N:1) → reviews
└── operator (N:1) → users
```

## 索引

建议创建以下索引以提高查询性能:

```sql
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_uploaderId ON videos(uploaderId);
CREATE INDEX idx_videos_uploadedAt ON videos(uploadedAt);
CREATE INDEX idx_videos_category ON videos(category);

CREATE INDEX idx_auditResults_videoId ON audit_results(videoId);
CREATE INDEX idx_auditResults_riskLevel ON audit_results(riskLevel);
CREATE INDEX idx_auditResults_processedAt ON audit_results(processedAt);

CREATE INDEX idx_reviews_videoId ON reviews(videoId);
CREATE INDEX idx_reviews_reviewerId ON reviews(reviewerId);
CREATE INDEX idx_reviews_reviewedAt ON reviews(reviewedAt);
CREATE INDEX idx_reviews_finalDecision ON reviews(finalDecision);

CREATE INDEX idx_auditLogs_videoId ON audit_logs(videoId);
CREATE INDEX idx_auditLogs_operatorId ON audit_logs(operatorId);
CREATE INDEX idx_auditLogs_operatedAt ON audit_logs(operatedAt);

CREATE INDEX idx_sensitiveKeywords_enabled ON sensitive_keywords(enabled);
CREATE INDEX idx_sensitiveKeywords_category ON sensitive_keywords(category);
```

## 数据保留策略

- 视频文件: 30 天后自动删除
- 审核日志: 永久保留（法规要求）
- 临时文件（关键帧、音频）: 7 天后自动删除
