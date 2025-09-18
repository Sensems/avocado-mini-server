import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisConfig = {
      socket: {
        host: this.configService.get('redis.host', 'localhost'),
        port: this.configService.get('redis.port', 6379),
      },
      password: this.configService.get('redis.password') || undefined,
      database: this.configService.get('redis.db', 0),
    };

    this.client = createClient(redisConfig);

    this.client.on('error', (error) => {
      this.logger.error('Redis Client Error:', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis Client Ready');
    });

    this.client.on('end', () => {
      this.logger.log('Redis Client Disconnected');
    });

    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.logger.log('Redis client disconnected');
    }
  }

  /**
   * 获取Redis客户端
   */
  getClient(): RedisClientType {
    return this.client;
  }

  /**
   * 设置键值对
   */
  async set(key: string, value: string | number | Buffer, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value.toString());
    } else {
      await this.client.set(key, value.toString());
    }
  }

  /**
   * 获取值
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result;
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * 原子递增
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * 原子递减
   */
  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  /**
   * 哈希表操作 - 设置字段
   */
  async hSet(key: string, field: string, value: string): Promise<number> {
    return this.client.hSet(key, field, value);
  }

  /**
   * 哈希表操作 - 获取字段
   */
  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.client.hGet(key, field);
  }

  /**
   * 哈希表操作 - 获取所有字段
   */
  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.client.hGetAll(key);
  }

  /**
   * 哈希表操作 - 删除字段
   */
  async hDel(key: string, field: string): Promise<number> {
    return this.client.hDel(key, field);
  }

  /**
   * 列表操作 - 左推入
   */
  async lPush(key: string, ...values: string[]): Promise<number> {
    return this.client.lPush(key, values);
  }

  /**
   * 列表操作 - 右推入
   */
  async rPush(key: string, ...values: string[]): Promise<number> {
    return this.client.rPush(key, values);
  }

  /**
   * 列表操作 - 左弹出
   */
  async lPop(key: string): Promise<string | null> {
    return this.client.lPop(key);
  }

  /**
   * 列表操作 - 右弹出
   */
  async rPop(key: string): Promise<string | null> {
    return this.client.rPop(key);
  }

  /**
   * 列表操作 - 获取长度
   */
  async lLen(key: string): Promise<number> {
    return this.client.lLen(key);
  }

  /**
   * 列表操作 - 获取范围
   */
  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lRange(key, start, stop);
  }

  /**
   * 集合操作 - 添加成员
   */
  async sAdd(key: string, ...members: string[]): Promise<number> {
    return this.client.sAdd(key, members);
  }

  /**
   * 集合操作 - 获取所有成员
   */
  async sMembers(key: string): Promise<string[]> {
    return this.client.sMembers(key);
  }

  /**
   * 集合操作 - 检查成员是否存在
   */
  async sIsMember(key: string, member: string): Promise<boolean> {
    return this.client.sIsMember(key, member);
  }

  /**
   * 有序集合操作 - 添加成员
   */
  async zAdd(key: string, score: number, member: string): Promise<number> {
    return this.client.zAdd(key, { score, value: member });
  }

  /**
   * 有序集合操作 - 获取范围
   */
  async zRange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zRange(key, start, stop);
  }

  /**
   * 发布消息
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  /**
   * 订阅频道
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(channel, (message) => {
      callback(message);
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * 获取Redis信息
   */
  async getInfo(): Promise<string> {
    return this.client.info();
  }

  /**
   * 清空当前数据库
   */
  async flushDb(): Promise<string> {
    return this.client.flushDb();
  }

  /**
   * 获取所有匹配的键
   */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
}