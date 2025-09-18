# Avocado Mini Server

基于 miniprogram-ci 构建的小程序自动化服务后端

## 项目简介

Avocado Mini Server 是一个企业级的小程序自动化构建服务，提供小程序代码的自动化构建、上传和预览功能，支持多种小程序框架，提升开发效率，降低人工操作成本。

## 技术栈

### 服务端
- **NestJS**: 企业级 Node.js 框架
- **TypeScript**: 类型安全的 JavaScript 超集
- **Prisma**: 现代化 ORM 框架
- **MySQL 8.0**: 关系型数据库
- **Redis 6.0**: 缓存数据库和队列管理
- **Bull**: Redis 队列处理
- **miniprogram-ci**: 微信官方小程序 CI 工具
- **Socket.IO**: WebSocket 实时通信
- **JWT**: 身份认证
- **Swagger**: API 文档生成

## 核心功能

### 用户管理
- 用户注册、登录、权限管理
- 基于角色的访问控制 (RBAC)
- JWT 身份认证

### 小程序管理
- 小程序配置管理
- 支持多种项目类型 (原生、uni-app、Taro、WePY)
- Git 仓库集成
- 版本管理

### 构建任务
- 异步构建队列
- 实时构建日志
- 构建进度跟踪
- 失败重试机制
- WebSocket 实时通信

### 通知系统
- 钉钉通知集成
- 构建结果通知
- 可扩展的通知方式

### 系统配置
- 动态配置管理
- Redis 缓存
- 系统监控

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- MySQL >= 8.0
- Redis >= 6.0
- Git

### 安装依赖

```bash
npm install
```

### 环境配置

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接等信息：

```env
# 数据库配置
DATABASE_URL="mysql://username:password@localhost:3306/avocado_mini"

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-here

# 其他配置...
```

### 数据库初始化

```bash
# 生成 Prisma 客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# 初始化种子数据
npm run db:seed
```

### 启动服务

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

服务启动后，访问：
- API 服务: http://localhost:3000
- API 文档: http://localhost:3000/api/docs

### 默认账户

系统初始化后会创建默认管理员账户：

- 用户名: `admin`
- 密码: `admin123456`
- 邮箱: `admin@avocado.com`

## API 文档

启动服务后，访问 http://localhost:3000/api/docs 查看完整的 API 文档。

### 主要 API 端点

- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/users` - 获取用户列表
- `POST /api/v1/miniprograms` - 创建小程序
- `POST /api/v1/miniprograms/{id}/upload` - 触发构建任务
- `GET /api/v1/build-tasks` - 获取构建任务列表
- `GET /api/v1/system/status` - 系统状态检查

## WebSocket 连接

构建任务支持 WebSocket 实时通信：

```javascript
const socket = io('ws://localhost:3000/build', {
  auth: {
    token: 'your-jwt-token'
  }
});

// 订阅构建任务
socket.emit('subscribe-task', { taskId: 'task-uuid' });

// 监听构建日志
socket.on('build-log', (data) => {
  console.log('Build log:', data.log);
});

// 监听构建进度
socket.on('build-progress', (data) => {
  console.log('Build progress:', data.progress);
});
```

## 项目结构

```
src/
├── app.module.ts              # 应用根模块
├── main.ts                    # 应用入口
├── config/                    # 配置文件
├── common/                    # 公共模块
│   ├── decorators/           # 装饰器
│   ├── filters/              # 异常过滤器
│   ├── interceptors/         # 拦截器
│   └── dto/                  # 数据传输对象
├── modules/                   # 业务模块
│   ├── auth/                 # 认证模块
│   ├── users/                # 用户管理
│   ├── miniprograms/         # 小程序管理
│   ├── build-tasks/          # 构建任务
│   ├── notifications/        # 通知系统
│   ├── system/               # 系统配置
│   ├── websocket/            # WebSocket
│   ├── prisma/               # 数据库
│   └── redis/                # Redis
└── prisma/                    # 数据库模式
    ├── schema.prisma         # 数据库模式定义
    └── seed.ts               # 种子数据
```

## 开发指南

### 代码规范

项目使用 ESLint 和 Prettier 进行代码格式化：

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 测试

```bash
# 单元测试
npm run test

# 测试覆盖率
npm run test:cov

# E2E 测试
npm run test:e2e
```

### 数据库操作

```bash
# 生成迁移文件
npm run prisma:migrate

# 重置数据库
npx prisma migrate reset

# 查看数据库
npm run prisma:studio
```

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t avocado-mini-server .

# 运行容器
docker run -p 3000:3000 avocado-mini-server
```

### PM2 部署

```bash
# 构建项目
npm run build

# 使用 PM2 启动
pm2 start dist/main.js --name avocado-mini-server
```

## 配置说明

### 构建配置

- `BUILD_WORKSPACE`: 构建工作目录，默认 `/tmp/build`
- `BUILD_TIMEOUT`: 构建超时时间，默认 30 分钟
- `MAX_CONCURRENT_BUILDS`: 最大并发构建数，默认 3
- `BUILD_QUEUE_SIZE`: 构建队列大小，默认 200

### 通知配置

支持钉钉通知，需要配置：

- `DINGTALK_WEBHOOK_URL`: 钉钉机器人 Webhook 地址
- `DINGTALK_SECRET`: 钉钉机器人密钥

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `DATABASE_URL` 配置
   - 确保 MySQL 服务正在运行
   - 检查数据库用户权限

2. **Redis 连接失败**
   - 检查 Redis 服务状态
   - 验证 Redis 连接配置

3. **构建任务失败**
   - 检查 Git 仓库访问权限
   - 验证小程序私钥配置
   - 查看构建日志获取详细错误信息

### 日志查看

```bash
# 查看应用日志
tail -f logs/application.log

# 查看错误日志
tail -f logs/error.log
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

- 项目地址: https://github.com/your-username/avocado-mini-server
- 问题反馈: https://github.com/your-username/avocado-mini-server/issues

## 更新日志

### v1.0.0 (2024-01-XX)

- 初始版本发布
- 支持小程序自动化构建
- 用户权限管理
- WebSocket 实时通信
- 钉钉通知集成