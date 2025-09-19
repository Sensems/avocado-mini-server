import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { User, NotificationConfigStatus } from '@prisma/client';
import { NotificationConfigsService } from './notification-configs.service';
import { CreateNotificationConfigDto } from './dto/create-notification-config.dto';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('notification-configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notification-configs')
export class NotificationConfigsController {
  constructor(private readonly notificationConfigsService: NotificationConfigsService) {}

  @Post()
  @RequirePermissions('notification-configs:create')
  @ApiOperation({ summary: '创建通知配置' })
  @ApiResponse({ status: 201, description: '通知配置创建成功' })
  @ApiResponse({ status: 409, description: '配置名称已存在' })
  create(@CurrentUser() user: User, @Body() createNotificationConfigDto: CreateNotificationConfigDto) {
    return this.notificationConfigsService.create(user.id, createNotificationConfigDto);
  }

  @Get()
  @RequirePermissions('notification-configs:read')
  @ApiOperation({ summary: '获取通知配置列表' })
  @ApiResponse({ status: 200, description: '获取通知配置列表成功' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向' })
  findAll(@CurrentUser() user: User, @Query() paginationDto: PaginationDto) {
    return this.notificationConfigsService.findAll(user.id, paginationDto);
  }

  @Get('available')
  @RequirePermissions('notification-configs:read')
  @ApiOperation({ summary: '获取可用的通知配置（用于下拉选择）' })
  @ApiResponse({ status: 200, description: '获取可用配置成功' })
  findAvailable(@CurrentUser() user: User) {
    return this.notificationConfigsService.findAvailableConfigs(user.id);
  }

  @Get(':id')
  @RequirePermissions('notification-configs:read')
  @ApiOperation({ summary: '根据ID获取通知配置信息' })
  @ApiResponse({ status: 200, description: '获取通知配置信息成功' })
  @ApiResponse({ status: 404, description: '通知配置不存在' })
  findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.notificationConfigsService.findOne(id, user.id);
  }

  @Patch(':id')
  @RequirePermissions('notification-configs:update')
  @ApiOperation({ summary: '更新通知配置信息' })
  @ApiResponse({ status: 200, description: '通知配置信息更新成功' })
  @ApiResponse({ status: 404, description: '通知配置不存在' })
  @ApiResponse({ status: 409, description: '配置名称已存在' })
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateNotificationConfigDto: UpdateNotificationConfigDto,
  ) {
    return this.notificationConfigsService.update(id, user.id, updateNotificationConfigDto);
  }

  @Delete(':id')
  @RequirePermissions('notification-configs:delete')
  @ApiOperation({ summary: '删除通知配置' })
  @ApiResponse({ status: 200, description: '通知配置删除成功' })
  @ApiResponse({ status: 404, description: '通知配置不存在' })
  @ApiResponse({ status: 400, description: '配置正在被使用，无法删除' })
  remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.notificationConfigsService.remove(id, user.id);
  }

  @Post('batch-update-status')
  @RequirePermissions('notification-configs:update')
  @ApiOperation({ summary: '批量更新通知配置状态' })
  @ApiResponse({ status: 200, description: '通知配置状态更新成功' })
  batchUpdateStatus(
    @CurrentUser() user: User,
    @Body() body: { ids: number[]; status: NotificationConfigStatus },
  ) {
    return this.notificationConfigsService.batchUpdateStatus(body.ids, body.status, user.id);
  }

  @Post(':id/test')
  @RequirePermissions('notification-configs:update')
  @ApiOperation({ summary: '测试通知配置' })
  @ApiResponse({ status: 200, description: '通知配置测试成功' })
  @ApiResponse({ status: 404, description: '通知配置不存在' })
  testConfig(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.notificationConfigsService.testNotificationConfig(id, user.id);
  }
}