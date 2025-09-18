import { Injectable, NotFoundException } from '@nestjs/common';
import { SystemConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SystemService {
  private readonly CACHE_PREFIX = 'system:config:';
  private readonly CACHE_TTL = 3600; // 1小时

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 获取所有系统配置
   */
  async getAllConfigs(includePrivate = false): Promise<SystemConfig[]> {
    const where = includePrivate ? {} : { isPublic: true };
    
    return this.prisma.systemConfig.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { key: 'asc' },
      ],
    });
  }

  /**
   * 根据键获取配置
   */
  async getConfig(key: string): Promise<SystemConfig | null> {
    // 先从缓存获取
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // 从数据库获取
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    if (config) {
      // 缓存配置
      await this.redis.set(cacheKey, JSON.stringify(config), this.CACHE_TTL);
    }

    return config;
  }

  /**
   * 根据键获取配置值
   */
  async getConfigValue<T = any>(key: string, defaultValue?: T): Promise<T> {
    const config = await this.getConfig(key);
    return config ? config.value as T : defaultValue;
  }

  /**
   * 根据分类获取配置
   */
  async getConfigsByCategory(category: string, includePrivate = false): Promise<SystemConfig[]> {
    const where = {
      category,
      ...(includePrivate ? {} : { isPublic: true }),
    };

    return this.prisma.systemConfig.findMany({
      where,
      orderBy: { key: 'asc' },
    });
  }

  /**
   * 设置配置
   */
  async setConfig(
    key: string,
    value: any,
    description?: string,
    category = 'general',
    isPublic = true,
  ): Promise<SystemConfig> {
    const config = await this.prisma.systemConfig.upsert({
      where: { key },
      update: {
        value,
        description,
        category,
        isPublic,
      },
      create: {
        key,
        value,
        description,
        category,
        isPublic,
      },
    });

    // 清除缓存
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    await this.redis.del(cacheKey);

    return config;
  }

  /**
   * 批量设置配置
   */
  async setBatchConfigs(configs: Array<{
    key: string;
    value: any;
    description?: string;
    category?: string;
    isPublic?: boolean;
  }>): Promise<void> {
    for (const config of configs) {
      await this.setConfig(
        config.key,
        config.value,
        config.description,
        config.category,
        config.isPublic,
      );
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(key: string): Promise<void> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException('配置不存在');
    }

    await this.prisma.systemConfig.delete({
      where: { key },
    });

    // 清除缓存
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    await this.redis.del(cacheKey);
  }

  /**
   * 清除所有配置缓存
   */
  async clearConfigCache(): Promise<void> {
    const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
    if (keys.length > 0) {
      for (const key of keys) {
        await this.redis.del(key);
      }
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<Record<string, any>> {
    // 数据库连接状态
    const dbHealthy = await this.prisma.healthCheck();
    
    // Redis连接状态
    const redisHealthy = await this.redis.healthCheck();

    // 系统信息
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    };

    return {
      status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: dbHealthy ? 'connected' : 'disconnected',
      },
      redis: {
        status: redisHealthy ? 'connected' : 'disconnected',
      },
      system: systemInfo,
    };
  }

  /**
   * 获取应用统计信息
   */
  async getAppStatistics(): Promise<Record<string, any>> {
    const [
      totalUsers,
      activeUsers,
      totalMiniprograms,
      activeMiniprograms,
      totalBuildTasks,
      todayBuildTasks,
      successBuildTasks,
      failedBuildTasks,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.miniprogram.count(),
      this.prisma.miniprogram.count({ where: { status: 'ACTIVE' } }),
      this.prisma.buildTask.count(),
      this.prisma.buildTask.count({
        where: {
          createTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.buildTask.count({ where: { status: 'SUCCESS' } }),
      this.prisma.buildTask.count({ where: { status: 'FAILED' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      miniprograms: {
        total: totalMiniprograms,
        active: activeMiniprograms,
      },
      buildTasks: {
        total: totalBuildTasks,
        today: todayBuildTasks,
        success: successBuildTasks,
        failed: failedBuildTasks,
        successRate: totalBuildTasks > 0 ? Math.round((successBuildTasks / totalBuildTasks) * 100) : 0,
      },
    };
  }

  /**
   * 获取构建趋势数据
   */
  async getBuildTrends(days = 7): Promise<Record<string, any>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const buildTasks = await this.prisma.buildTask.findMany({
      where: {
        createTime: {
          gte: startDate,
        },
      },
      select: {
        createTime: true,
        status: true,
        type: true,
      },
    });

    // 按日期分组统计
    const trends = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      trends[dateStr] = {
        total: 0,
        success: 0,
        failed: 0,
        upload: 0,
        preview: 0,
      };
    }

    buildTasks.forEach(task => {
      const dateStr = task.createTime.toISOString().split('T')[0];
      if (trends[dateStr]) {
        trends[dateStr].total++;
        
        if (task.status === 'SUCCESS') {
          trends[dateStr].success++;
        } else if (task.status === 'FAILED') {
          trends[dateStr].failed++;
        }
        
        if (task.type === 'UPLOAD') {
          trends[dateStr].upload++;
        } else if (task.type === 'PREVIEW') {
          trends[dateStr].preview++;
        }
      }
    });

    return trends;
  }
}