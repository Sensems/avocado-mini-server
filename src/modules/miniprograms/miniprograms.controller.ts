import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MiniprogramStatus, User, UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RequirePermissions } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateMiniprogramDto } from './dto/create-miniprogram.dto';
import { UpdateMiniprogramDto } from './dto/update-miniprogram.dto';
import { MiniprogramsService } from './miniprograms.service';

@ApiTags('miniprograms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('miniprograms')
export class MiniprogramsController {
  constructor(private readonly miniprogramsService: MiniprogramsService) {}

  @Post()
  @RequirePermissions('miniprograms:create')
  @ApiOperation({ summary: '创建小程序' })
  @ApiResponse({ status: 201, description: '小程序创建成功' })
  @ApiResponse({ status: 409, description: 'AppID已存在' })
  create(@CurrentUser() user: User, @Body() createMiniprogramDto: CreateMiniprogramDto) {
    return this.miniprogramsService.create(user.id, createMiniprogramDto);
  }

  @Get()
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '获取小程序列表' })
  @ApiResponse({ status: 200, description: '获取小程序列表成功' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向' })
  findAll(@CurrentUser() user: User, @Query() paginationDto: PaginationDto) {
    // 普通用户只能查看自己的小程序，管理员可以查看所有
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.findAll(userId, paginationDto);
  }

  @Get('statistics')
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '获取小程序统计信息' })
  @ApiResponse({ status: 200, description: '获取统计信息成功' })
  getStatistics(@CurrentUser() user: User) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.getStatistics(userId);
  }

  @Get(':id')
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '根据ID获取小程序信息' })
  @ApiResponse({ status: 200, description: '获取小程序信息成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.findOne(id, userId);
  }

  @Get(':id/build-statistics')
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '获取小程序构建统计信息' })
  @ApiResponse({ status: 200, description: '获取构建统计信息成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  getBuildStatistics(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.getBuildStatistics(id, userId);
  }

  @Patch(':id')
  @RequirePermissions('miniprograms:update')
  @ApiOperation({ summary: '更新小程序信息' })
  @ApiResponse({ status: 200, description: '小程序信息更新成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  @ApiResponse({ status: 409, description: 'AppID已存在' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateMiniprogramDto: UpdateMiniprogramDto,
  ) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.update(id, updateMiniprogramDto, userId);
  }

  @Delete(':id')
  @RequirePermissions('miniprograms:delete')
  @ApiOperation({ summary: '删除小程序' })
  @ApiResponse({ status: 200, description: '小程序删除成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  @ApiResponse({ status: 400, description: '存在正在进行的构建任务，无法删除' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.remove(id, userId);
  }

  @Post('batch-update-status')
  @RequirePermissions('miniprograms:update')
  @ApiOperation({ summary: '批量更新小程序状态' })
  @ApiResponse({ status: 200, description: '小程序状态更新成功' })
  batchUpdateStatus(
    @CurrentUser() user: User,
    @Body() body: { ids: string[]; status: MiniprogramStatus },
  ) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.batchUpdateStatus(body.ids, body.status, userId);
  }

  @Post(':id/auto-increment-version')
  @RequirePermissions('miniprograms:update')
  @ApiOperation({ summary: '自动递增版本号' })
  @ApiResponse({ status: 200, description: '版本号更新成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  autoIncrementVersion(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.autoIncrementVersion(id, userId);
  }

  @Post(':id/upload-private-key')
  @RequirePermissions('miniprograms:update')
  @UseInterceptors(
    FileInterceptor('privateKey', {
      storage: diskStorage({
        destination: './uploads/private-keys',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${req.params.id}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.originalname.endsWith('.key') || 
            file.originalname.endsWith('.pem')) {
          callback(null, true);
        } else {
          callback(new Error('只允许上传 .key 或 .pem 格式的私钥文件'), false);
        }
      },
      limits: {
        fileSize: 1024 * 1024, // 1MB
      },
    }),
  )
  @ApiOperation({ summary: '上传小程序私钥文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '上传私钥文件',
    schema: {
      type: 'object',
      properties: {
        privateKey: {
          type: 'string',
          format: 'binary',
          description: '私钥文件 (.key 或 .pem 格式，最大1MB)',
        },
      },
      required: ['privateKey'],
    },
  })
  @ApiResponse({ status: 200, description: '私钥文件上传成功' })
  @ApiResponse({ status: 400, description: '文件格式不正确或文件过大' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  async uploadPrivateKey(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.miniprogramsService.uploadPrivateKey(id, file, user.role === UserRole.ADMIN ? undefined : user.id);
  }

  @Get(':id/webhooks')
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '获取小程序的 Webhook 列表' })
  @ApiResponse({ status: 200, description: '获取 Webhook 列表成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  getWebhooks(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    // 这里需要注入 WebhooksService 或者通过 MiniprogramsService 代理
    // 为了保持模块解耦，建议在前端直接调用 webhooks API
    return { message: '请使用 /webhooks API 并传入 appId 参数' };
  }

  @Post(':id/generate-webhook')
  @RequirePermissions('miniprograms:update')
  @ApiOperation({ summary: '为小程序生成 Webhook 配置' })
  @ApiResponse({ status: 200, description: '生成 Webhook 配置成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  async generateWebhookConfig(@CurrentUser() user: User, @Param('id') id: string) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const secret = require('crypto').randomBytes(32).toString('hex');
    
    // 验证小程序是否存在且用户有权限
    await this.miniprogramsService.findOne(id, user.role === UserRole.ADMIN ? undefined : user.id);
    
    return {
      webhookConfig: {
        url: `${baseUrl}/webhooks/events/${id}`,
        secret,
        events: ['push', 'pull_request'],
      },
      platformUrls: {
        github: `${baseUrl}/webhooks/github/${id}`,
        gitlab: `${baseUrl}/webhooks/gitlab/${id}`,
        gitee: `${baseUrl}/webhooks/gitee/${id}`,
      },
      instructions: {
        github: '在 GitHub 仓库设置中添加 Webhook，选择 application/json 格式',
        gitlab: '在 GitLab 项目设置中添加 Webhook，选择 Push events 和 Merge request events',
        gitee: '在 Gitee 仓库管理中添加 WebHook，选择 Push 和 Pull Request 事件',
      },
    };
  }

  @Get(':id/webhook-url')
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '获取小程序的 Webhook URL' })
  @ApiResponse({ status: 200, description: '获取 Webhook URL 成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  getWebhookUrl(@CurrentUser() user: User, @Param('id') id: string) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return {
      webhookUrls: {
        generic: `${baseUrl}/webhooks/events/${id}`,
        github: `${baseUrl}/webhooks/github/${id}`,
        gitlab: `${baseUrl}/webhooks/gitlab/${id}`,
        gitee: `${baseUrl}/webhooks/gitee/${id}`,
      },
      instructions: {
        github: '在 GitHub 仓库设置中添加 Webhook，选择 application/json 格式',
        gitlab: '在 GitLab 项目设置中添加 Webhook，选择 Push events 和 Merge request events',
        gitee: '在 Gitee 仓库管理中添加 WebHook，选择 Push 和 Pull Request 事件',
      },
    };
  }
}