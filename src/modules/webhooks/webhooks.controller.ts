import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { GenerateWebhookDto } from './dto/generate-webhook.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建 Webhook' })
  @ApiResponse({ status: 201, description: 'Webhook 创建成功' })
  async create(@Request() req: any, @Body() createWebhookDto: CreateWebhookDto) {
    return this.webhooksService.create(req.user.id, createWebhookDto);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '生成 Webhook URL 和密钥' })
  @ApiResponse({ status: 200, description: '生成成功' })
  async generateWebhook(@Request() req: any, @Body() body: GenerateWebhookDto) {
    return this.webhooksService.generateWebhookConfig(req.user.id, body.appId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Webhook 列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async findAll(
    @Request() req: any,
    @Query() paginationDto: PaginationDto,
    @Query('appId') appId?: number,
  ) {
    return this.webhooksService.findAll(req.user.id, paginationDto, appId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Webhook 详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.findOne(+id, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新 Webhook' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(+id, updateWebhookDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除 Webhook' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.remove(+id, req.user.id);
  }

  @Post(':id/test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '测试 Webhook' })
  @ApiResponse({ 
    status: 200, 
    description: '测试成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            webhook: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                url: { type: 'string' },
                events: { type: 'array' },
                status: { type: 'string' },
                lastTrigger: { type: 'string', format: 'date-time' },
              },
            },
            miniprogram: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                appId: { type: 'string' },
                autoBuild: { type: 'boolean' },
                gitBranch: { type: 'string' },
              },
            },
            testEvent: { type: 'object' },
            buildTrigger: {
              type: 'object',
              properties: {
                should: { type: 'boolean' },
                reason: { type: 'string' },
              },
            },
            validation: {
              type: 'object',
              properties: {
                isValid: { type: 'boolean' },
                reason: { type: 'string' },
                checks: { type: 'object' },
              },
            },
          },
        },
      },
    },
  })
  async test(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.testWebhook(+id, req.user.id);
  }

  // 接收 Git 仓库事件的公开端点
  @Post('events/:appId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '接收 Git 仓库事件' })
  @ApiResponse({ status: 200, description: '事件处理成功' })
  async handleGitEvent(
    @Param('appId') appId: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    try {
      this.logger.log(`接收到 Git 事件，小程序ID: ${appId}`);
      this.logger.debug(`Headers: ${JSON.stringify(headers)}`);
      this.logger.debug(`Payload: ${JSON.stringify(payload)}`);

      // 验证请求来源和签名
      const eventType = this.extractEventType(headers);
      if (!eventType) {
        throw new BadRequestException('无法识别的事件类型');
      }

      // 处理事件
      const result = await this.webhooksService.handleGitEvent(
        +appId,
        eventType,
        payload,
        headers,
      );

      return {
        success: true,
        message: '事件处理成功',
        data: result,
      };
    } catch (error) {
      this.logger.error(`处理 Git 事件失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // GitHub Webhook 端点
  @Post('github/:appId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '接收 GitHub Webhook 事件' })
  async handleGitHubEvent(
    @Param('appId') appId: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    const eventType = headers['x-github-event'];
    if (!eventType) {
      throw new BadRequestException('缺少 GitHub 事件类型');
    }

    return this.handleGitEvent(appId, payload, {
      ...headers,
      'x-event-type': eventType,
      'x-git-provider': 'github',
    });
  }

  // GitLab Webhook 端点
  @Post('gitlab/:appId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '接收 GitLab Webhook 事件' })
  async handleGitLabEvent(
    @Param('appId') appId: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    const eventType = headers['x-gitlab-event'];
    if (!eventType) {
      throw new BadRequestException('缺少 GitLab 事件类型');
    }

    return this.handleGitEvent(appId, payload, {
      ...headers,
      'x-event-type': eventType,
      'x-git-provider': 'gitlab',
    });
  }

  // Gitee Webhook 端点
  @Post('gitee/:appId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '接收 Gitee Webhook 事件' })
  async handleGiteeEvent(
    @Param('appId') appId: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    const eventType = headers['x-gitee-event'];
    if (!eventType) {
      throw new BadRequestException('缺少 Gitee 事件类型');
    }

    return this.handleGitEvent(appId, payload, {
      ...headers,
      'x-event-type': eventType,
      'x-git-provider': 'gitee',
    });
  }

  /**
   * 从请求头中提取事件类型
   */
  private extractEventType(headers: Record<string, string>): string | null {
    // GitHub
    if (headers['x-github-event']) {
      return headers['x-github-event'];
    }
    
    // GitLab
    if (headers['x-gitlab-event']) {
      return headers['x-gitlab-event'];
    }
    
    // Gitee
    if (headers['x-gitee-event']) {
      return headers['x-gitee-event'];
    }

    // 通用事件类型
    if (headers['x-event-type']) {
      return headers['x-event-type'];
    }

    return null;
  }
}