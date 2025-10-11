import { ApiPropertyOptional } from '@nestjs/swagger';
import { MiniprogramStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { UpdateMiniprogramConfigDto } from './update-miniprogram-config.dto';

export class UpdateMiniprogramDto {
  @ApiPropertyOptional({ description: '小程序名称' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '小程序AppID' })
  @IsOptional()
  appId?: string;

  @ApiPropertyOptional({ description: '小程序AppSecret' })
  @IsOptional()
  appSecret?: string;

  @ApiPropertyOptional({ description: '当前版本号' })
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({ description: '小程序描述' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '小程序状态', enum: MiniprogramStatus })
  @IsOptional()
  @IsEnum(MiniprogramStatus)
  status?: MiniprogramStatus;

  @ApiPropertyOptional({ description: 'Git认证凭据ID' })
  @IsOptional()
  @IsString()
  gitCredentialId?: string;

  @ApiPropertyOptional({ description: '通知配置ID列表' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notificationConfigIds?: string[];

  @ApiPropertyOptional({ description: '小程序配置信息' })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateMiniprogramConfigDto)
  config?: UpdateMiniprogramConfigDto;
}