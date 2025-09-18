import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '获取应用信息' })
  @ApiResponse({ status: 200, description: '返回应用基本信息' })
  getAppInfo(): Record<string, any> {
    return this.appService.getAppInfo();
  }

  @Get('health')
  @ApiOperation({ summary: '健康检查' })
  @ApiResponse({ status: 200, description: '服务健康状态' })
  healthCheck(): Record<string, any> {
    return this.appService.healthCheck();
  }
}