import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuildType } from '@prisma/client';

export class UploadMiniprogramDto {
  @ApiProperty({ description: '构建类型', enum: BuildType })
  @IsEnum(BuildType)
  type: BuildType;

  @ApiPropertyOptional({ description: 'Git分支' })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({ description: '版本号' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: '版本描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '构建优先级', minimum: 1, maximum: 3, default: 2 })
  @IsOptional()
  priority?: number;
}