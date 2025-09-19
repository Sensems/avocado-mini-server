import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class SendNotificationDto {
  @ApiProperty({ 
    description: '通知类型',
    enum: NotificationType,
    example: NotificationType.DINGTALK
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ 
    description: '通知标题',
    example: '构建完成通知'
  })
  @IsString()
  title: string;

  @ApiProperty({ 
    description: '通知内容',
    example: '小程序构建任务已完成'
  })
  @IsString()
  content: string;

  @ApiProperty({ 
    description: '接收者',
    example: 'user@example.com'
  })
  @IsString()
  recipient: string;

  @ApiPropertyOptional({ 
    description: '通知配置（可选）',
    example: { webhook: 'https://oapi.dingtalk.com/robot/send?access_token=xxx' }
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}