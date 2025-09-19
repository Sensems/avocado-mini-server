import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUrl, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class CreateNotificationConfigDto {
  @ApiProperty({ description: '配置名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '通知类型', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({ description: '配置描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '通知配置参数（JSON格式）' })
  @IsObject()
  config: Record<string, any>;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  enabled?: boolean;
}