# Webhook 功能使用指南

## 概述

Webhook 功能允许小程序项目根据 Git 仓库的推送或 Pull Request 事件自动触发构建和预览。支持 GitHub、GitLab、Gitee 等主流 Git 平台。

## 功能特性

- 🚀 支持多种 Git 平台（GitHub、GitLab、Gitee）
- 🔒 支持签名验证，确保请求安全性
- 🎯 支持事件过滤，只监听指定类型的事件
- 🔄 自动触发构建任务和预览
- 📊 提供详细的事件处理日志
- ⚙️ 灵活的配置选项

## 数据库设计

系统利用现有的数据库字段：

### Webhook 表
- `id`: 主键
- `url`: Webhook URL
- `secret`: 签名密钥（可选）
- `events`: 监听的事件类型（JSON 数组）
- `status`: 状态（ACTIVE/INACTIVE）
- `appId`: 关联的小程序ID
- `lastTrigger`: 最后触发时间

### 小程序配置表 (MiniprogramConfig)
- `autoBuild`: 是否启用自动构建
- `gitBranch`: 监听的分支
- `gitUrl`: Git 仓库地址

### 构建任务表 (BuildTask)
- `triggerType`: 触发方式（MANUAL/WEBHOOK/SCHEDULED）
- `commitId`: 提交ID
- `commitMessage`: 提交信息
- `commitAuthor`: 提交作者

## API 接口

### 1. Webhook 管理

#### 创建 Webhook
```http
POST /webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://api.example.com/webhook",
  "secret": "your-secret-key",
  "events": ["push", "pull_request"],
  "appId": 1
}
```

#### 获取 Webhook 列表
```http
GET /webhooks?appId=1&page=1&limit=10
Authorization: Bearer <token>
```

#### 更新 Webhook
```http
PATCH /webhooks/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "events": ["push"],
  "status": "ACTIVE"
}
```

#### 删除 Webhook
```http
DELETE /webhooks/:id
Authorization: Bearer <token>
```

#### 测试 Webhook
```http
POST /webhooks/:id/test
Authorization: Bearer <token>
```

### 2. 接收 Git 事件

#### 通用端点
```http
POST /webhooks/events/:appId
Content-Type: application/json

{
  "event": "push",
  "payload": { ... }
}
```

#### GitHub 专用端点
```http
POST /webhooks/github/:appId
X-GitHub-Event: push
X-Hub-Signature-256: sha256=...
Content-Type: application/json

{
  "ref": "refs/heads/main",
  "commits": [...],
  "repository": { ... }
}
```

#### GitLab 专用端点
```http
POST /webhooks/gitlab/:appId
X-Gitlab-Event: Push Hook
X-Gitlab-Token: your-token
Content-Type: application/json

{
  "event_name": "push",
  "project": { ... },
  "commits": [...]
}
```

#### Gitee 专用端点
```http
POST /webhooks/gitee/:appId
X-Gitee-Event: push
Content-Type: application/json

{
  "ref": "refs/heads/main",
  "commits": [...],
  "repository": { ... }
}
```

### 3. 小程序 Webhook 信息

#### 获取 Webhook URL
```http
GET /miniprograms/:id/webhook-url
Authorization: Bearer <token>
```

响应：
```json
{
  "webhookUrls": {
    "generic": "http://localhost:3000/webhooks/events/1",
    "github": "http://localhost:3000/webhooks/github/1",
    "gitlab": "http://localhost:3000/webhooks/gitlab/1",
    "gitee": "http://localhost:3000/webhooks/gitee/1"
  },
  "instructions": {
    "github": "在 GitHub 仓库设置中添加 Webhook，选择 application/json 格式",
    "gitlab": "在 GitLab 项目设置中添加 Webhook，选择 Push events 和 Merge request events",
    "gitee": "在 Gitee 仓库管理中添加 WebHook，选择 Push 和 Pull Request 事件"
  }
}
```

## 配置指南

### 1. 小程序配置

确保小程序配置了以下参数：

```json
{
  "autoBuild": true,
  "gitBranch": "main",
  "gitUrl": "https://github.com/user/repo.git"
}
```

### 2. GitHub 配置

1. 进入 GitHub 仓库设置页面
2. 点击 "Webhooks" → "Add webhook"
3. 填写 Payload URL: `https://your-domain.com/webhooks/github/{appId}`
4. 选择 Content type: `application/json`
5. 填写 Secret（可选）
6. 选择触发事件：
   - Push events
   - Pull requests
7. 点击 "Add webhook"

### 3. GitLab 配置

1. 进入 GitLab 项目设置页面
2. 点击 "Webhooks"
3. 填写 URL: `https://your-domain.com/webhooks/gitlab/{appId}`
4. 填写 Secret Token（可选）
5. 选择触发事件：
   - Push events
   - Merge request events
6. 点击 "Add webhook"

### 4. Gitee 配置

1. 进入 Gitee 仓库管理页面
2. 点击 "WebHooks"
3. 填写 URL: `https://your-domain.com/webhooks/gitee/{appId}`
4. 选择触发事件：
   - Push
   - Pull Request
5. 点击 "添加"

## 事件处理流程

1. **接收事件**: Webhook 端点接收 Git 平台发送的事件
2. **验证签名**: 如果配置了密钥，验证请求签名
3. **解析事件**: 根据平台类型解析事件数据
4. **检查配置**: 验证小程序是否启用自动构建
5. **分支匹配**: 检查事件分支是否匹配配置分支
6. **触发构建**: 创建构建任务并加入队列
7. **记录日志**: 记录事件处理结果

## 支持的事件类型

### Push 事件
- 代码推送到指定分支时触发
- 自动创建预览构建任务

### Pull Request 事件
- PR 合并到目标分支时触发
- 只有合并的 PR 才会触发构建

## 安全考虑

1. **签名验证**: 建议为所有 Webhook 配置密钥
2. **HTTPS**: 生产环境必须使用 HTTPS
3. **权限控制**: 只有有权限的用户才能管理 Webhook
4. **日志记录**: 记录所有 Webhook 事件用于审计

## 故障排除

### 常见问题

1. **Webhook 未触发**
   - 检查小程序是否启用了自动构建
   - 确认分支名称是否匹配
   - 查看 Webhook 状态是否为 ACTIVE

2. **签名验证失败**
   - 确认密钥配置正确
   - 检查 Git 平台的签名算法

3. **构建任务未创建**
   - 检查小程序配置是否完整
   - 确认用户权限是否正确

### 调试方法

1. 查看应用日志：
```bash
# 查看 Webhook 相关日志
grep "Webhook" logs/application.log
```

2. 测试 Webhook：
```bash
curl -X POST http://localhost:3000/webhooks/test/1 \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

3. 检查数据库记录：
```sql
-- 查看 Webhook 配置
SELECT * FROM webhooks WHERE appId = 1;

-- 查看构建任务
SELECT * FROM build_tasks WHERE triggerType = 'WEBHOOK' ORDER BY createTime DESC;
```

## 环境变量

```env
# 应用基础 URL（用于生成 Webhook URL）
APP_URL=https://your-domain.com

# 数据库连接
DATABASE_URL=mysql://user:password@localhost:3306/database

# Redis 配置（用于队列）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## 扩展功能

### 自定义事件处理

可以通过扩展 `WebhooksService` 来支持更多事件类型：

```typescript
// 添加新的事件解析器
private parseCustomEvent(eventType: string, payload: any): GitEventData | null {
  // 自定义解析逻辑
}

// 添加新的触发条件
private shouldTriggerBuild(eventData: GitEventData, miniprogram: any): boolean {
  // 自定义触发逻辑
}
```

### 通知集成

Webhook 事件可以与现有的通知系统集成，在构建完成后发送通知。

## 版本历史

- v1.0.0: 基础 Webhook 功能
- v1.1.0: 支持多平台签名验证
- v1.2.0: 添加事件过滤和自定义配置