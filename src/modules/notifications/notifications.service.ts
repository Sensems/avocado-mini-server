import { Injectable, Logger } from '@nestjs/common';
import { Notification, NotificationStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DingtalkService } from './services/dingtalk.service';

export interface SendNotificationOptions {
  type: NotificationType;
  title: string;
  content: string;
  recipient: string;
  config?: Record<string, any>;
  taskId?: string;
  userId: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dingtalkService: DingtalkService,
  ) {}

  /**
   * 发送通知
   */
  async sendNotification(options: SendNotificationOptions): Promise<Notification> {
    const { type, title, content, recipient, config, taskId, userId } = options;

    // 创建通知记录
    const notification = await this.prisma.notification.create({
      data: {
        type,
        title,
        content,
        recipient,
        config,
        taskId,
        userId,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      let result: any = {};

      // 根据通知类型发送
      switch (type) {
        case NotificationType.DINGTALK:
          result = await this.dingtalkService.sendMessage({
            title,
            content,
            webhook: config?.webhook || recipient,
            secret: config?.secret,
          });
          break;

        case NotificationType.EMAIL:
          // TODO: 实现邮件发送
          throw new Error('邮件通知暂未实现');

        case NotificationType.WECHAT:
          // TODO: 实现微信通知
          throw new Error('微信通知暂未实现');

        case NotificationType.SMS:
          // TODO: 实现短信通知
          throw new Error('短信通知暂未实现');

        default:
          throw new Error(`不支持的通知类型: ${type}`);
      }

      // 更新通知状态为已发送
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          result,
          sentAt: new Date(),
        },
      });

      this.logger.log(`Notification ${notification.id} sent successfully`);

      return notification;

    } catch (error) {
      this.logger.error(`Failed to send notification ${notification.id}:`, error);

      // 更新通知状态为发送失败
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          result: { error: error.message },
          retryCount: notification.retryCount + 1,
        },
      });

      throw error;
    }
  }

  /**
   * 发送构建完成通知
   */
  async sendBuildCompleteNotification(
    taskId: string,
    success: boolean,
    details: Record<string, any>,
  ): Promise<void> {
    try {
      // 获取构建任务信息
      const buildTask = await this.prisma.buildTask.findUnique({
        where: { id: taskId },
        include: {
          miniprogram: {
            include: {
              config: true,
            },
          },
          user: true,
        },
      });

      if (!buildTask) {
        this.logger.warn(`Build task ${taskId} not found for notification`);
        return;
      }

      const status = success ? '成功' : '失败';
      const emoji = success ? '✅' : '❌';
      
      const title = `${emoji} 小程序构建${status}`;
      const content = this.formatBuildNotificationContent(buildTask, success, details);

      // 发送钉钉通知（如果配置了）
      const config = buildTask.miniprogram.config as any;
      const dingtalkConfig = config?.notification?.dingtalk;
      if (dingtalkConfig?.enabled && dingtalkConfig?.webhook) {
        await this.sendNotification({
          type: NotificationType.DINGTALK,
          title,
          content,
          recipient: dingtalkConfig.webhook,
          config: {
            webhook: dingtalkConfig.webhook,
            secret: dingtalkConfig.secret,
          },
          taskId,
          userId: buildTask.userId,
        });
      }

      // TODO: 发送其他类型的通知

    } catch (error) {
      this.logger.error(`Failed to send build complete notification for task ${taskId}:`, error);
    }
  }

  /**
   * 格式化构建通知内容
   */
  private formatBuildNotificationContent(
    buildTask: any,
    success: boolean,
    details: Record<string, any>,
  ): string {
    const { miniprogram, type, version, branch, operator, duration } = buildTask;
    const buildType = type === 'UPLOAD' ? '上传' : '预览';
    
    let content = `### 📦 ${miniprogram.name} 构建${success ? '成功' : '失败'}\n\n`;
    content += `- **构建类型**: ${buildType}\n`;
    content += `- **分支**: ${branch}\n`;
    content += `- **版本**: ${version}\n`;
    content += `- **操作人**: ${operator}\n`;
    
    if (duration) {
      content += `- **耗时**: ${duration}秒\n`;
    }

    if (success) {
      if (details.qrcodeUrl) {
        content += `\n![二维码](${details.qrcodeUrl})\n`;
      }
      
      if (details.packageSize) {
        content += `\n**包大小信息**:\n`;
        content += `\`\`\`json\n${JSON.stringify(details.packageSize, null, 2)}\n\`\`\`\n`;
      }
    } else {
      if (details.error) {
        content += `\n**错误信息**: ${details.error}\n`;
      }
    }

    return content;
  }

  /**
   * 重试失败的通知
   */
  async retryFailedNotifications(): Promise<number> {
    const failedNotifications = await this.prisma.notification.findMany({
      where: {
        status: NotificationStatus.FAILED,
        retryCount: { lt: 3 },
      },
      take: 10, // 每次最多重试10个
    });

    let retryCount = 0;

    for (const notification of failedNotifications) {
      try {
        await this.sendNotification({
          type: notification.type,
          title: notification.title,
          content: notification.content,
          recipient: notification.recipient,
          config: notification.config as Record<string, any>,
          taskId: notification.taskId,
          userId: notification.userId,
        });
        retryCount++;
      } catch (error) {
        this.logger.error(`Failed to retry notification ${notification.id}:`, error);
      }
    }

    this.logger.log(`Retried ${retryCount} failed notifications`);
    return retryCount;
  }

  /**
   * 清理过期的通知记录
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 30); // 30天前

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: expiredDate,
        },
        status: {
          in: [NotificationStatus.SENT, NotificationStatus.FAILED],
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired notifications`);
    return result.count;
  }
}