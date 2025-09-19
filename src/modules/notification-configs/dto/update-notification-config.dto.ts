import { IsString, IsOptional, IsEnum, IsObject, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, NotificationConfigStatus } from '@prisma/client';

export class UpdateNotificationConfigDto {
  @ApiPropertyOptional({ description: '配置名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '通知类型', enum: NotificationType })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({ description: '配置描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '通知配置参数（JSON格式）' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '配置状态', enum: NotificationConfigStatus })
  @IsEnum(NotificationConfigStatus)
  @IsOptional()
  status?: NotificationConfigStatus;
}