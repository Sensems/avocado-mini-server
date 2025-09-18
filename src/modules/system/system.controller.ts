import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions, Public } from '../../common/decorators/auth.decorator';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: '获取系统状态' })
  @ApiResponse({ status: 200, description: '获取系统状态成功' })
  getSystemStatus() {
    return this.systemService.getSystemStatus();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('statistics')
  @RequirePermissions('system:read')
  @ApiOperation({ summary: '获取应用统计信息' })
  @ApiResponse({ status: 200, description: '获取统计信息成功' })
  getAppStatistics() {
    return this.systemService.getAppStatistics();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('build-trends')
  @RequirePermissions('system:read')
  @ApiOperation({ summary: '获取构建趋势数据' })
  @ApiResponse({ status: 200, description: '获取趋势数据成功' })
  @ApiQuery({ name: 'days', required: false, description: '天数', type: Number })
  getBuildTrends(@Query('days') days?: number) {
    return this.systemService.getBuildTrends(days);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('configs')
  @RequirePermissions('system:read')
  @ApiOperation({ summary: '获取所有系统配置' })
  @ApiResponse({ status: 200, description: '获取配置成功' })
  @ApiQuery({ name: 'includePrivate', required: false, description: '是否包含私有配置' })
  getAllConfigs(@Query('includePrivate') includePrivate?: boolean) {
    return this.systemService.getAllConfigs(includePrivate);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('configs/category/:category')
  @RequirePermissions('system:read')
  @ApiOperation({ summary: '根据分类获取配置' })
  @ApiResponse({ status: 200, description: '获取配置成功' })
  @ApiQuery({ name: 'includePrivate', required: false, description: '是否包含私有配置' })
  getConfigsByCategory(
    @Param('category') category: string,
    @Query('includePrivate') includePrivate?: boolean,
  ) {
    return this.systemService.getConfigsByCategory(category, includePrivate);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('configs/:key')
  @RequirePermissions('system:read')
  @ApiOperation({ summary: '根据键获取配置' })
  @ApiResponse({ status: 200, description: '获取配置成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  getConfig(@Param('key') key: string) {
    return this.systemService.getConfig(key);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('configs')
  @RequirePermissions('system:update')
  @ApiOperation({ summary: '设置配置' })
  @ApiResponse({ status: 201, description: '配置设置成功' })
  setConfig(@Body() body: {
    key: string;
    value: any;
    description?: string;
    category?: string;
    isPublic?: boolean;
  }) {
    return this.systemService.setConfig(
      body.key,
      body.value,
      body.description,
      body.category,
      body.isPublic,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('configs/batch')
  @RequirePermissions('system:update')
  @ApiOperation({ summary: '批量设置配置' })
  @ApiResponse({ status: 200, description: '批量设置成功' })
  setBatchConfigs(@Body() body: {
    configs: Array<{
      key: string;
      value: any;
      description?: string;
      category?: string;
      isPublic?: boolean;
    }>;
  }) {
    return this.systemService.setBatchConfigs(body.configs);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Put('configs/:key')
  @RequirePermissions('system:update')
  @ApiOperation({ summary: '更新配置' })
  @ApiResponse({ status: 200, description: '配置更新成功' })
  updateConfig(
    @Param('key') key: string,
    @Body() body: {
      value: any;
      description?: string;
      category?: string;
      isPublic?: boolean;
    },
  ) {
    return this.systemService.setConfig(
      key,
      body.value,
      body.description,
      body.category,
      body.isPublic,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('configs/:key')
  @RequirePermissions('system:update')
  @ApiOperation({ summary: '删除配置' })
  @ApiResponse({ status: 200, description: '配置删除成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  deleteConfig(@Param('key') key: string) {
    return this.systemService.deleteConfig(key);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('configs/clear-cache')
  @RequirePermissions('system:update')
  @ApiOperation({ summary: '清除配置缓存' })
  @ApiResponse({ status: 200, description: '缓存清除成功' })
  clearConfigCache() {
    return this.systemService.clearConfigCache();
  }
}