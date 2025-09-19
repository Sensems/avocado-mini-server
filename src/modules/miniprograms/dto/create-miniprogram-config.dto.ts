import { IsString, IsOptional, IsEnum, IsBoolean, IsUrl, IsObject, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType, VersionType, QrcodeFormat } from '@prisma/client';

export class CreateMiniprogramConfigDto {
  @ApiProperty({ description: 'Git仓库地址' })
  @IsString()
  @IsUrl()
  gitUrl: string;

  @ApiPropertyOptional({ description: 'Git分支', default: 'master' })
  @IsOptional()
  @IsString()
  gitBranch?: string;

  @ApiPropertyOptional({ description: '构建命令' })
  @IsOptional()
  @IsString()
  buildCommand?: string;

  @ApiPropertyOptional({ description: '输出目录' })
  @IsOptional()
  @IsString()
  outputDir?: string;

  @ApiPropertyOptional({ description: '项目类型', enum: ProjectType, default: ProjectType.NATIVE })
  @IsOptional()
  @IsEnum(ProjectType)
  projectType?: ProjectType;

  @ApiPropertyOptional({ description: 'Git认证凭据ID' })
  @IsOptional()
  @IsNumber()
  gitCredentialId?: number;

  @ApiPropertyOptional({ description: '通知配置ID' })
  @IsOptional()
  @IsNumber()
  notificationConfigId?: number;

  @ApiPropertyOptional({ description: '是否自动管理版本号', default: false })
  @IsOptional()
  @IsBoolean()
  autoVersion?: boolean;

  @ApiPropertyOptional({ description: '版本类型', enum: VersionType, default: VersionType.AUTO })
  @IsOptional()
  @IsEnum(VersionType)
  versionType?: VersionType;

  @ApiPropertyOptional({ description: '上传配置' })
  @IsOptional()
  @IsObject()
  uploadConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: '预览配置' })
  @IsOptional()
  @IsObject()
  previewConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: '二维码格式', enum: QrcodeFormat, default: QrcodeFormat.IMAGE })
  @IsOptional()
  @IsEnum(QrcodeFormat)
  qrcodeFormat?: QrcodeFormat;

  @ApiPropertyOptional({ description: '二维码输出路径' })
  @IsOptional()
  @IsString()
  qrcodeDest?: string;

  @ApiPropertyOptional({ description: '扩展配置' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}