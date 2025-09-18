import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import { User, UserRole } from '@prisma/client';
import { BuildTasksService } from './build-tasks.service';
import { CreateBuildTaskDto } from './dto/create-build-task.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('build-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('build-tasks')
export class BuildTasksController {
  constructor(private readonly buildTasksService: BuildTasksService) {}

  @Post()
  @RequirePermissions('buildTasks:create')
  @ApiOperation({ summary: '创建构建任务' })
  @ApiResponse({ status: 201, description: '构建任务创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误或队列已满' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  create(@CurrentUser() user: User, @Body() createBuildTaskDto: CreateBuildTaskDto) {
    return this.buildTasksService.create(user.id, createBuildTaskDto);
  }

  @Get()
  @RequirePermissions('buildTasks:read')
  @ApiOperation({ summary: '获取构建任务列表' })
  @ApiResponse({ status: 200, description: '获取构建任务列表成功' })
  @ApiQuery({ name: 'appId', required: false, description: '小程序ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向' })
  findAll(
    @CurrentUser() user: User,
    @Query('appId', ParseIntPipe) appId?: number,
    @Query() paginationDto?: PaginationDto,
  ) {
    // 普通用户只能查看自己的构建任务，管理员可以查看所有
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.buildTasksService.findAll(userId, appId, paginationDto);
  }

  @Get('statistics')
  @RequirePermissions('buildTasks:read')
  @ApiOperation({ summary: '获取构建任务统计信息' })
  @ApiResponse({ status: 200, description: '获取统计信息成功' })
  @ApiQuery({ name: 'appId', required: false, description: '小程序ID' })
  getStatistics(
    @CurrentUser() user: User,
    @Query('appId', ParseIntPipe) appId?: number,
  ) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.buildTasksService.getStatistics(userId, appId);
  }

  @Get('queue-status')
  @RequirePermissions('buildTasks:read')
  @ApiOperation({ summary: '获取构建队列状态' })
  @ApiResponse({ status: 200, description: '获取队列状态成功' })
  getQueueStatus() {
    return this.buildTasksService.getQueueStatus();
  }

  @Get(':id')
  @RequirePermissions('buildTasks:read')
  @ApiOperation({ summary: '根据ID获取构建任务详情' })
  @ApiResponse({ status: 200, description: '获取构建任务详情成功' })
  @ApiResponse({ status: 404, description: '构建任务不存在' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.buildTasksService.findOne(id, userId);
  }

  @Post(':id/cancel')
  @RequirePermissions('buildTasks:update')
  @ApiOperation({ summary: '取消构建任务' })
  @ApiResponse({ status: 200, description: '构建任务取消成功' })
  @ApiResponse({ status: 400, description: '只能取消等待中或运行中的任务' })
  @ApiResponse({ status: 404, description: '构建任务不存在' })
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.buildTasksService.cancel(id, userId);
  }

  @Post(':id/retry')
  @RequirePermissions('buildTasks:create')
  @ApiOperation({ summary: '重试构建任务' })
  @ApiResponse({ status: 200, description: '构建任务重试成功' })
  @ApiResponse({ status: 400, description: '只能重试失败的任务或重试次数已达上限' })
  @ApiResponse({ status: 404, description: '构建任务不存在' })
  retry(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.buildTasksService.retry(id, userId);
  }

  @Post('cleanup-expired')
  @RequirePermissions('buildTasks:delete')
  @ApiOperation({ summary: '清理过期的构建任务' })
  @ApiResponse({ status: 200, description: '清理完成' })
  cleanupExpired() {
    return this.buildTasksService.cleanupExpiredTasks();
  }
}