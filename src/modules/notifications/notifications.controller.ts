import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { DingtalkService } from './services/dingtalk.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly dingtalkService: DingtalkService,
  ) {}

  @Post('send')
  @RequirePermissions('notifications:create')
  @ApiOperation({ summary: '发送通知' })
  @ApiResponse({ status: 201, description: '通知发送成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  sendNotification(
    @CurrentUser() user: User,
    @Body() body: {
      type: NotificationType;
      title: string;
      content: string;
      recipient: string;
      config?: Record<string, any>;
    },
  ) {
    return this.notificationsService.sendNotification({
      ...body,
      userId: user.id,
    });
  }

  @Post('test-dingtalk')
  @RequirePermissions('notifications:create')
  @ApiOperation({ summary: '测试钉钉Webhook' })
  @ApiResponse({ status: 200, description: '测试成功' })
  @ApiResponse({ status: 400, description: '测试失败' })
  async testDingtalkWebhook(
    @Body() body: { webhook: string; secret?: string },
  ) {
    const success = await this.dingtalkService.testWebhook(body.webhook, body.secret);
    return { success, message: success ? '测试成功' : '测试失败' };
  }

  @Post('retry-failed')
  @RequirePermissions('notifications:update')
  @ApiOperation({ summary: '重试失败的通知' })
  @ApiResponse({ status: 200, description: '重试完成' })
  retryFailedNotifications() {
    return this.notificationsService.retryFailedNotifications();
  }

  @Post('cleanup-expired')
  @RequirePermissions('notifications:delete')
  @ApiOperation({ summary: '清理过期的通知记录' })
  @ApiResponse({ status: 200, description: '清理完成' })
  cleanupExpiredNotifications() {
    return this.notificationsService.cleanupExpiredNotifications();
  }
}