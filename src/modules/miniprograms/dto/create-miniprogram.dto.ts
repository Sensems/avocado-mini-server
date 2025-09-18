import { IsString, IsOptional, IsEnum, IsBoolean, MaxLength, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType } from '@prisma/client';

export class CreateMiniprogramDto {
  @ApiProperty({ description: '小程序名称', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '小程序AppID', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  appId: string;

  @ApiPropertyOptional({ description: '小程序AppSecret' })
  @IsOptional()
  @IsString()
  appSecret?: string;

  @ApiProperty({ description: '小程序私钥内容' })
  @IsString()
  privateKey: string;

  @ApiProperty({ description: 'Git仓库地址' })
  @IsString()
  @IsUrl()
  gitUrl: string;

  @ApiPropertyOptional({ description: 'Git分支', default: 'master' })
  @IsOptional()
  @IsString()
  gitBranch?: string;

  @ApiPropertyOptional({ description: 'Git用户名' })
  @IsOptional()
  @IsString()
  gitUsername?: string;

  @ApiPropertyOptional({ description: 'Git密码' })
  @IsOptional()
  @IsString()
  gitPassword?: string;

  @ApiPropertyOptional({ description: 'Git访问令牌' })
  @IsOptional()
  @IsString()
  gitToken?: string;

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

  @ApiPropertyOptional({ description: '是否自动管理版本号', default: false })
  @IsOptional()
  @IsBoolean()
  autoVersion?: boolean;

  @ApiPropertyOptional({ description: '当前版本号', default: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: '小程序描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '扩展配置' })
  @IsOptional()
  config?: Record<string, any>;
}