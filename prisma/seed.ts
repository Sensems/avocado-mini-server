import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  console.log('🌱 开始数据库种子数据初始化...');

  // 创建管理员用户
  const hashedPassword = await bcrypt.hash('admin123456', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@avocado.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@avocado.com',
      password: hashedPassword,
      nickname: '系统管理员',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      permissions: {
        users: ['create', 'read', 'update', 'delete'],
        miniprograms: ['create', 'read', 'update', 'delete'],
        buildTasks: ['create', 'read', 'update', 'delete'],
        notifications: ['create', 'read', 'update', 'delete'],
        system: ['read', 'update'],
      },
    },
  });

  console.log('✅ 管理员用户创建成功:', admin);

  // 创建测试用户
  const testUserPassword = await bcrypt.hash('test123456', 10);
  
  const testUser = await prisma.user.upsert({
    where: { email: 'test@avocado.com' },
    update: {},
    create: {
      username: 'testuser',
      email: 'test@avocado.com',
      password: testUserPassword,
      nickname: '测试用户',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      permissions: {
        miniprograms: ['create', 'read', 'update'],
        buildTasks: ['create', 'read'],
        notifications: ['read'],
      },
    },
  });

  console.log('✅ 测试用户创建成功:', testUser);

  // 创建系统配置
  const systemConfigs = [
    {
      key: 'build.maxConcurrentBuilds',
      value: 3,
      description: '最大并发构建数量',
      category: 'build',
      isPublic: true,
    },
    {
      key: 'build.timeout',
      value: 1800000,
      description: '构建超时时间(毫秒)',
      category: 'build',
      isPublic: true,
    },
    {
      key: 'build.queueSize',
      value: 200,
      description: '构建队列大小',
      category: 'build',
      isPublic: true,
    },
    {
      key: 'notification.dingtalk.enabled',
      value: true,
      description: '是否启用钉钉通知',
      category: 'notification',
      isPublic: true,
    },
    {
      key: 'upload.maxFileSize',
      value: 10485760,
      description: '最大文件上传大小(字节)',
      category: 'upload',
      isPublic: true,
    },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }

  console.log('✅ 系统配置创建成功');

  console.log('🎉 数据库种子数据初始化完成!');
};

main()
  .catch((e) => {
    console.error('❌ 数据库种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });