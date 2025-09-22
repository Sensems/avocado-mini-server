import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType, QrcodeFormat, VersionType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateMiniprogramConfigDto {
  @ApiProperty({ description: 'Git仓库地址' })
  @IsString()
  @IsUrl()
  gitUrl: string;

  @ApiPropertyOptional({ description: 'Git分支', default: 'master' })
  @IsOptional()
  @IsString()
  gitBranch?: string;

  @ApiPropertyOptional({ description: 'Git认证凭据ID' })
  @IsOptional()
  @IsNumber()
  gitCredentialId?: number;

  @ApiPropertyOptional({ description: '是否安装依赖', default: true })
  @IsOptional()
  @IsBoolean()
  install?: boolean;

  @ApiPropertyOptional({ description: '安装命令', default: 'npm install' })
  @IsOptional()
  @IsString()
  installCommand?: string;

  @ApiPropertyOptional({ description: '构建命令' })
  @IsOptional()
  @IsString()
  buildCommand?: string;

  @ApiPropertyOptional({ description: '输出路径' })
  @IsOptional()
  @IsString()
  outputPath?: string;

  @ApiPropertyOptional({ description: '项目类型', enum: ProjectType, default: ProjectType.NATIVE })
  @IsOptional()
  @IsEnum(ProjectType)
  projectType?: ProjectType;

  @ApiPropertyOptional({ description: '是否使用npm', default: false })
  @IsOptional()
  @IsBoolean()
  npm?: boolean;

  @ApiPropertyOptional({ description: '是否自动构建', default: false })
  @IsOptional()
  @IsBoolean()
  autoBuild?: boolean;

  @ApiPropertyOptional({ description: '构建超时时间(分钟)', default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  buildTimeout?: number;

  @ApiPropertyOptional({ description: '版本类型', enum: VersionType, default: VersionType.MANUAL })
  @IsOptional()
  @IsEnum(VersionType)
  versionType?: VersionType;

  @ApiPropertyOptional({ description: '是否自动管理版本号', default: false })
  @IsOptional()
  @IsBoolean()
  autoVersion?: boolean;

  @ApiPropertyOptional({ description: '是否启用ES6转ES5', default: true })
  @IsOptional()
  @IsBoolean()
  es6?: boolean;

  @ApiPropertyOptional({ description: '是否启用ES7转ES5', default: true })
  @IsOptional()
  @IsBoolean()
  es7?: boolean;

  @ApiPropertyOptional({ description: '是否压缩JS', default: true })
  @IsOptional()
  @IsBoolean()
  minifyJS?: boolean;

  @ApiPropertyOptional({ description: '是否压缩WXML', default: true })
  @IsOptional()
  @IsBoolean()
  minifyWXML?: boolean;

  @ApiPropertyOptional({ description: '是否压缩WXSS', default: true })
  @IsOptional()
  @IsBoolean()
  minifyWXSS?: boolean;

  @ApiPropertyOptional({ description: '是否压缩', default: false })
  @IsOptional()
  @IsBoolean()
  minify?: boolean;

  @ApiPropertyOptional({ description: '是否代码保护', default: false })
  @IsOptional()
  @IsBoolean()
  codeProtect?: boolean;

  @ApiPropertyOptional({ description: '是否自动补全WXSS', default: true })
  @IsOptional()
  @IsBoolean()
  autoPrefixWXSS?: boolean;

  @ApiPropertyOptional({ description: '二维码格式', enum: QrcodeFormat, default: QrcodeFormat.IMAGE })
  @IsOptional()
  @IsEnum(QrcodeFormat)
  qrcodeFormat?: QrcodeFormat;

  @ApiPropertyOptional({ description: '页面路径' })
  @IsOptional()
  @IsString()
  pagePath?: string;

  @ApiPropertyOptional({ description: '搜索查询参数' })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiPropertyOptional({ description: '场景值', default: 1011 })
  @IsOptional()
  @IsNumber()
  scene?: number;

  @ApiPropertyOptional({ description: '通知配置ID' })
  @IsOptional()
  @IsNumber()
  notificationConfigId?: number;

  @ApiPropertyOptional({ description: '二维码输出路径' })
  @IsOptional()
  @IsString()
  qrcodeDest?: string;
}