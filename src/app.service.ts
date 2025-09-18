import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getAppInfo(): Record<string, any> {
    return {
      name: this.configService.get('APP_NAME', 'Avocado Mini Server'),
      version: this.configService.get('APP_VERSION', '1.0.0'),
      description: '基于miniprogram-ci构建的小程序自动化服务',
      environment: this.configService.get('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
    };
  }

  healthCheck(): Record<string, any> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
    };
  }
}