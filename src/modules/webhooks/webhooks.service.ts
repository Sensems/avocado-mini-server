import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TriggerType, UserRole, Webhook, WebhookStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PaginationDto, PaginationResult } from '../../common/dto/pagination.dto';
import { BuildTasksService } from '../build-tasks/build-tasks.service';
import { MiniprogramsService } from '../miniprograms/miniprograms.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

export interface GitEventData {
  eventType: string;
  provider: string;
  repository: {
    name: string;
    url: string;
    defaultBranch: string;
  };
  branch: string;
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    timestamp: string;
    url: string;
  }>;
  pusher?: {
    name: string;
    email: string;
  };
  pullRequest?: {
    id: number;
    number: number;
    title: string;
    state: string;
    merged: boolean;
    headRef: string;
    baseRef: string;
    user: {
      login: string;
    };
  };
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buildTasksService: BuildTasksService,
    private readonly miniprogramsService: MiniprogramsService,
  ) {}

  /**
   * 创建 Webhook
   */
  async create(userId: number, createWebhookDto: CreateWebhookDto): Promise<Webhook> {
    const { appId, ...webhookData } = createWebhookDto;

    // 检查小程序是否存在且用户有权限
    const miniprogram = await this.miniprogramsService.findOne(appId, userId);
    if (!miniprogram) {
      throw new NotFoundException('小程序不存在或无权限访问');
    }

    // 自动生成 URL 和密钥
    let finalWebhookData = { ...webhookData };

    // 验证必填字段
    if (!finalWebhookData.url) {
      throw new BadRequestException('URL是必填字段，请提供URL或启用自动生成');
    }

    // 检查是否已存在相同URL的webhook
    const existingWebhook = await this.prisma.webhook.findFirst({
      where: {
        appId,
        url: finalWebhookData.url,
      },
    });

    if (existingWebhook) {
      throw new BadRequestException('该URL的Webhook已存在');
    }

    return this.prisma.webhook.create({
      data: {
        url: finalWebhookData.url!,
        secret: finalWebhookData.secret,
        events: finalWebhookData.events,
        appId,
      },
    });
  }

  /**
   * 获取 Webhook 列表
   */
  async findAll(
    userId?: number,
    paginationDto?: PaginationDto,
    appId?: number,
  ): Promise<PaginationResult<Webhook>> {
    const { page = 1, limit = 10 } = paginationDto || {};
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: Prisma.WebhookWhereInput = {};

    if (appId) {
      // 检查用户是否有权限访问该小程序
      if (userId) {
        const miniprogram = await this.miniprogramsService.findOne(appId, userId);
        if (!miniprogram) {
          throw new ForbiddenException('无权限访问该小程序的Webhook');
        }
      }
      where.appId = appId;
    } else if (userId) {
      // 如果没有指定appId，则只返回用户有权限的小程序的webhook
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== UserRole.ADMIN) {
        where.miniprogram = {
          userId,
        };
      }
    }

    const [webhooks, total] = await Promise.all([
      this.prisma.webhook.findMany({
        where,
        skip,
        take: limit,
        include: {
          miniprogram: {
            select: {
              id: true,
              name: true,
              appId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.webhook.count({ where }),
    ]);

    return {
      data: webhooks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };
  }

  /**
   * 获取 Webhook 详情
   */
  async findOne(id: number, userId?: number): Promise<Webhook> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
      include: {
        miniprogram: true,
      },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook不存在');
    }

    // 检查权限
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== UserRole.ADMIN && webhook.miniprogram.userId !== userId) {
        throw new ForbiddenException('无权限访问该Webhook');
      }
    }

    return webhook;
  }

  /**
   * 更新 Webhook
   */
  async update(
    id: number,
    updateWebhookDto: UpdateWebhookDto,
    userId?: number,
  ): Promise<Webhook> {
    const webhook = await this.findOne(id, userId);

    return this.prisma.webhook.update({
      where: { id },
      data: {
        ...updateWebhookDto,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除 Webhook
   */
  async remove(id: number, userId?: number): Promise<void> {
    const webhook = await this.findOne(id, userId);

    await this.prisma.webhook.delete({
      where: { id },
    });
  }

  /**
   * 测试 Webhook
   */
  async testWebhook(id: number, userId?: number): Promise<{ success: boolean; message: string; data?: any }> {
    const webhook = await this.findOne(id, userId);

    try {
      // 获取关联的小程序信息
      const miniprogram = await this.miniprogramsService.findOne(webhook.appId, userId);
      if (!miniprogram) {
        throw new NotFoundException('关联的小程序不存在');
      }

      // 创建测试事件数据
      const testEventData: GitEventData = {
        eventType: 'push',
        provider: 'test',
        repository: {
          name: miniprogram.name || 'test-repo',
          url: miniprogram.config?.gitUrl || 'https://github.com/test/test-repo',
          defaultBranch: miniprogram.config?.gitBranch || 'main',
        },
        branch: miniprogram.config?.gitBranch || 'main',
        commits: [
          {
            id: 'test-commit-' + Date.now(),
            message: 'Test commit for webhook validation',
            author: {
              name: 'Webhook Test',
              email: 'webhook-test@example.com',
            },
            timestamp: new Date().toISOString(),
            url: `${miniprogram.config?.gitUrl || 'https://github.com/test/test-repo'}/commit/test-commit-${Date.now()}`,
          },
        ],
        pusher: {
          name: 'Webhook Test',
          email: 'webhook-test@example.com',
        },
      };

      // 验证 Webhook 配置
      const validationResult = this.validateWebhookConfig(webhook, testEventData);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: `Webhook 配置验证失败: ${validationResult.reason}`,
          data: {
            webhook: {
              id: webhook.id,
              url: webhook.url,
              events: webhook.events,
              status: webhook.status,
            },
            validation: validationResult,
          },
        };
      }

      // 模拟事件处理流程
      const shouldTrigger = this.shouldTriggerBuild(testEventData, miniprogram);
      
      // 记录测试日志
      this.logger.log(`测试 Webhook ${id}，小程序: ${miniprogram.name} (ID: ${webhook.appId})`);
      this.logger.log(`事件类型: ${testEventData.eventType}, 分支: ${testEventData.branch}`);
      this.logger.log(`是否触发构建: ${shouldTrigger.should}, 原因: ${shouldTrigger.reason}`);

      // 更新 Webhook 最后触发时间（测试时也更新）
      await this.prisma.webhook.update({
        where: { id },
        data: { lastTrigger: new Date() },
      });

      return {
        success: true,
        message: 'Webhook 测试成功',
        data: {
          webhook: {
            id: webhook.id,
            url: webhook.url,
            events: webhook.events,
            status: webhook.status,
            lastTrigger: new Date(),
          },
          miniprogram: {
             id: miniprogram.id,
             name: miniprogram.name,
             appId: miniprogram.appId,
             autoBuild: miniprogram.config?.autoBuild,
             gitBranch: miniprogram.config?.gitBranch,
           },
          testEvent: testEventData,
          buildTrigger: shouldTrigger,
          validation: validationResult,
        },
      };
    } catch (error) {
      this.logger.error(`Webhook 测试失败: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Webhook 测试失败: ${error.message}`,
        data: {
          webhook: {
            id: webhook.id,
            url: webhook.url,
            events: webhook.events,
            status: webhook.status,
          },
          error: {
            name: error.name,
            message: error.message,
          },
        },
      };
    }
  }

  /**
   * 验证 Webhook 配置
   */
  private validateWebhookConfig(webhook: any, eventData: GitEventData): { 
    isValid: boolean; 
    reason: string; 
    checks: Record<string, boolean> 
  } {
    const checks = {
      webhookActive: webhook.status === 'ACTIVE',
      eventSupported: Array.isArray(webhook.events) && webhook.events.includes(eventData.eventType),
      urlValid: !!webhook.url && webhook.url.length > 0,
      hasValidEvents: Array.isArray(webhook.events) && webhook.events.length > 0,
    };

    const failedChecks = Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([check]) => check);

    if (failedChecks.length > 0) {
      const reasons = {
        webhookActive: 'Webhook 状态不是 ACTIVE',
        eventSupported: `Webhook 不监听 ${eventData.eventType} 事件`,
        urlValid: 'Webhook URL 无效',
        hasValidEvents: 'Webhook 未配置监听事件',
      };

      return {
        isValid: false,
        reason: failedChecks.map(check => reasons[check]).join(', '),
        checks,
      };
    }

    return {
      isValid: true,
      reason: '配置验证通过',
      checks,
    };
  }

  /**
   * 处理 Git 事件
   */
  async handleGitEvent(
    appId: number,
    eventType: string,
    payload: any,
    headers: Record<string, string>,
  ): Promise<{ triggered: boolean; taskId?: string; message: string }> {
    try {
      // 获取小程序信息
      const miniprogram = await this.miniprogramsService.findOne(appId);
      if (!miniprogram) {
        throw new NotFoundException('小程序不存在');
      }

      // 获取该小程序的 webhook 配置
      const webhooks = await this.prisma.webhook.findMany({
        where: {
          appId,
          status: WebhookStatus.ACTIVE,
        },
      });

      if (webhooks.length === 0) {
        return {
          triggered: false,
          message: '该小程序未配置活跃的Webhook',
        };
      }

      // 解析事件数据
      const eventData = this.parseGitEvent(eventType, payload, headers);
      if (!eventData) {
        return {
          triggered: false,
          message: '不支持的事件类型或数据格式',
        };
      }

      // 检查是否有webhook监听该事件类型
      const matchingWebhook = webhooks.find(webhook => {
        const events = Array.isArray(webhook.events) ? webhook.events : [];
        return events.includes(eventData.eventType);
      });

      if (!matchingWebhook) {
        return {
          triggered: false,
          message: `没有Webhook监听 ${eventData.eventType} 事件`,
        };
      }

      // 验证签名（如果配置了密钥）
      if (matchingWebhook.secret) {
        const isValid = this.verifySignature(
          matchingWebhook.secret,
          JSON.stringify(payload),
          headers,
        );
        if (!isValid) {
          throw new BadRequestException('Webhook签名验证失败');
        }
      }

      // 更新webhook最后触发时间
      await this.prisma.webhook.update({
        where: { id: matchingWebhook.id },
        data: { lastTrigger: new Date() },
      });

      // 根据事件类型决定是否触发构建
      const shouldTriggerBuild = this.shouldTriggerBuild(eventData, miniprogram);
      if (!shouldTriggerBuild.should) {
        return {
          triggered: false,
          message: shouldTriggerBuild.reason,
        };
      }

      // 触发构建任务
      const buildTask = await this.triggerBuild(eventData, miniprogram);

      this.logger.log(
        `Webhook 事件处理成功，触发构建任务: ${buildTask.id}，小程序: ${miniprogram.name}`,
      );

      return {
        triggered: true,
        taskId: buildTask.id,
        message: '构建任务已触发',
      };
    } catch (error) {
      this.logger.error(`处理 Git 事件失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 解析 Git 事件数据
   */
  private parseGitEvent(
    eventType: string,
    payload: any,
    headers: Record<string, string>,
  ): GitEventData | null {
    const provider = headers['x-git-provider'] || 'unknown';

    try {
      switch (provider) {
        case 'github':
          return this.parseGitHubEvent(eventType, payload);
        case 'gitlab':
          return this.parseGitLabEvent(eventType, payload);
        case 'gitee':
          return this.parseGiteeEvent(eventType, payload);
        default:
          // 尝试通用解析
          return this.parseGenericEvent(eventType, payload);
      }
    } catch (error) {
      this.logger.error(`解析 ${provider} 事件失败: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * 解析 GitHub 事件
   */
  private parseGitHubEvent(eventType: string, payload: any): GitEventData | null {
    switch (eventType) {
      case 'push':
        return {
          eventType: 'push',
          provider: 'github',
          repository: {
            name: payload.repository.name,
            url: payload.repository.html_url,
            defaultBranch: payload.repository.default_branch,
          },
          branch: payload.ref.replace('refs/heads/', ''),
          commits: payload.commits.map((commit: any) => ({
            id: commit.id,
            message: commit.message,
            author: {
              name: commit.author.name,
              email: commit.author.email,
            },
            timestamp: commit.timestamp,
            url: commit.url,
          })),
          pusher: {
            name: payload.pusher.name,
            email: payload.pusher.email,
          },
        };

      case 'pull_request':
        return {
          eventType: 'pull_request',
          provider: 'github',
          repository: {
            name: payload.repository.name,
            url: payload.repository.html_url,
            defaultBranch: payload.repository.default_branch,
          },
          branch: payload.pull_request.head.ref,
          commits: [], // PR事件不包含具体提交信息
          pullRequest: {
            id: payload.pull_request.id,
            number: payload.pull_request.number,
            title: payload.pull_request.title,
            state: payload.pull_request.state,
            merged: payload.pull_request.merged || false,
            headRef: payload.pull_request.head.ref,
            baseRef: payload.pull_request.base.ref,
            user: {
              login: payload.pull_request.user.login,
            },
          },
        };

      default:
        return null;
    }
  }

  /**
   * 解析 GitLab 事件
   */
  private parseGitLabEvent(eventType: string, payload: any): GitEventData | null {
    switch (eventType) {
      case 'Push Hook':
        return {
          eventType: 'push',
          provider: 'gitlab',
          repository: {
            name: payload.project.name,
            url: payload.project.web_url,
            defaultBranch: payload.project.default_branch,
          },
          branch: payload.ref.replace('refs/heads/', ''),
          commits: payload.commits.map((commit: any) => ({
            id: commit.id,
            message: commit.message,
            author: {
              name: commit.author.name,
              email: commit.author.email,
            },
            timestamp: commit.timestamp,
            url: commit.url,
          })),
          pusher: {
            name: payload.user_name,
            email: payload.user_email,
          },
        };

      case 'Merge Request Hook':
        return {
          eventType: 'pull_request',
          provider: 'gitlab',
          repository: {
            name: payload.project.name,
            url: payload.project.web_url,
            defaultBranch: payload.project.default_branch,
          },
          branch: payload.object_attributes.source_branch,
          commits: [],
          pullRequest: {
            id: payload.object_attributes.id,
            number: payload.object_attributes.iid,
            title: payload.object_attributes.title,
            state: payload.object_attributes.state,
            merged: payload.object_attributes.state === 'merged',
            headRef: payload.object_attributes.source_branch,
            baseRef: payload.object_attributes.target_branch,
            user: {
              login: payload.user.username,
            },
          },
        };

      default:
        return null;
    }
  }

  /**
   * 解析 Gitee 事件
   */
  private parseGiteeEvent(eventType: string, payload: any): GitEventData | null {
    // Gitee 事件格式类似 GitHub，可以复用部分逻辑
    return this.parseGitHubEvent(eventType, payload);
  }

  /**
   * 通用事件解析
   */
  private parseGenericEvent(eventType: string, payload: any): GitEventData | null {
    // 尝试从通用格式中提取信息
    if (payload.repository && payload.commits) {
      return {
        eventType: eventType,
        provider: 'generic',
        repository: {
          name: payload.repository.name || 'unknown',
          url: payload.repository.url || payload.repository.html_url || '',
          defaultBranch: payload.repository.default_branch || 'main',
        },
        branch: payload.ref ? payload.ref.replace('refs/heads/', '') : 'main',
        commits: Array.isArray(payload.commits) ? payload.commits : [],
        pusher: payload.pusher || payload.user,
      };
    }

    return null;
  }

  /**
   * 验证 Webhook 签名
   */
  private verifySignature(
    secret: string,
    payload: string,
    headers: Record<string, string>,
  ): boolean {
    try {
      // GitHub 签名验证
      const githubSignature = headers['x-hub-signature-256'];
      if (githubSignature) {
        const expectedSignature = `sha256=${crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex')}`;
        return crypto.timingSafeEqual(
          Buffer.from(githubSignature),
          Buffer.from(expectedSignature),
        );
      }

      // GitLab 签名验证
      const gitlabToken = headers['x-gitlab-token'];
      if (gitlabToken) {
        return crypto.timingSafeEqual(
          Buffer.from(gitlabToken),
          Buffer.from(secret),
        );
      }

      // 其他平台的签名验证可以在这里添加

      return true; // 如果没有签名头，则跳过验证
    } catch (error) {
      this.logger.error(`签名验证失败: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 判断是否应该触发构建
   */
  private shouldTriggerBuild(
    eventData: GitEventData,
    miniprogram: any,
  ): { should: boolean; reason: string } {
    // 检查小程序配置
    if (!miniprogram.config) {
      return {
        should: false,
        reason: '小程序未配置构建参数',
      };
    }

    // 检查是否启用自动构建
    if (!miniprogram.config.autoBuild) {
      return {
        should: false,
        reason: '小程序未启用自动构建',
      };
    }

    // 检查分支匹配
    const configBranch = miniprogram.config.gitBranch || 'master';
    if (eventData.branch !== configBranch) {
      return {
        should: false,
        reason: `分支不匹配，配置分支: ${configBranch}，事件分支: ${eventData.branch}`,
      };
    }

    // 检查事件类型
    switch (eventData.eventType) {
      case 'push':
        // 推送事件总是触发构建
        return { should: true, reason: '推送事件触发构建' };

      case 'pull_request':
        // 只有合并的PR才触发构建
        if (eventData.pullRequest?.merged) {
          return { should: true, reason: 'PR合并触发构建' };
        }
        return { should: false, reason: 'PR未合并，不触发构建' };

      default:
        return { should: false, reason: `不支持的事件类型: ${eventData.eventType}` };
    }
  }

  /**
   * 触发构建任务
   */
  private async triggerBuild(eventData: GitEventData, miniprogram: any) {
    const latestCommit = eventData.commits[0] || {
      id: 'unknown',
      message: `${eventData.eventType} event`,
      author: eventData.pusher || { name: 'Unknown', email: 'unknown@example.com' },
    };

    // 自动递增版本号
    const newVersion = await this.miniprogramsService.autoIncrementVersion(
      miniprogram.id,
      miniprogram.userId,
    );

    // 创建构建任务
    const buildTaskDto = {
      appId: miniprogram.id,
      type: 'PREVIEW' as const, // 默认创建预览任务
      branch: eventData.branch,
      commitId: latestCommit.id,
      version: newVersion,
      description: `Webhook触发: ${latestCommit.message}`,
      operator: latestCommit.author.name,
      triggerType: TriggerType.WEBHOOK,
    };

    return this.buildTasksService.create(miniprogram.userId, buildTaskDto);
  }

  /**
   * 生成 Webhook 密钥
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 生成 Webhook 配置
   */
  async generateWebhookConfig(userId: number, appId: number): Promise<{
    url: string;
    secret: string;
    githubUrl: string;
    gitlabUrl: string;
    giteeUrl: string;
  }> {
    // 检查小程序是否存在且用户有权限
    const miniprogram = await this.miniprogramsService.findOne(appId, userId);
    if (!miniprogram) {
      throw new NotFoundException('小程序不存在或无权限访问');
    }

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const secret = this.generateWebhookSecret();

    return {
      url: `${baseUrl}/webhooks/events/${appId}`,
      secret,
      githubUrl: `${baseUrl}/webhooks/github/${appId}`,
      gitlabUrl: `${baseUrl}/webhooks/gitlab/${appId}`,
      giteeUrl: `${baseUrl}/webhooks/gitee/${appId}`,
    };
  }
}