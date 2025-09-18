export default () => ({
  // 应用配置
  app: {
    name: process.env.APP_NAME || 'Avocado Mini Server',
    version: process.env.APP_VERSION || '1.0.0',
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV || 'development',
  },

  // 数据库配置
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 文件上传配置
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
  },

  // 微信小程序配置
  wechat: {
    appId: process.env.WECHAT_APP_ID,
    appSecret: process.env.WECHAT_APP_SECRET,
  },

  // 钉钉通知配置
  dingtalk: {
    webhookUrl: process.env.DINGTALK_WEBHOOK_URL,
    secret: process.env.DINGTALK_SECRET,
  },

  // 构建配置
  build: {
    workspace: process.env.BUILD_WORKSPACE || '/tmp/build',
    timeout: parseInt(process.env.BUILD_TIMEOUT, 10) || 1800000, // 30分钟
    maxConcurrentBuilds: parseInt(process.env.MAX_CONCURRENT_BUILDS, 10) || 3,
    queueSize: parseInt(process.env.BUILD_QUEUE_SIZE, 10) || 200,
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
});