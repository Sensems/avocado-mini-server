import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuildType, TriggerType } from '@prisma/client';

export class CreateBuildTaskDto {
  @ApiProperty({ description: '小程序ID' })
  @IsInt()
  appId: number;

  @ApiProperty({ description: '构建类型', enum: BuildType })
  @IsEnum(BuildType)
  type: BuildType;

  @ApiPropertyOptional({ description: '优先级', minimum: 1, maximum: 3, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  priority?: number;

  @ApiProperty({ description: 'Git分支' })
  @IsString()
  branch: string;

  @ApiPropertyOptional({ description: 'Commit ID' })
  @IsOptional()
  @IsString()
  commitId?: string;

  @ApiProperty({ description: '版本号' })
  @IsString()
  version: string;

  @ApiPropertyOptional({ description: '版本描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '操作人' })
  @IsString()
  operator: string;

  @ApiPropertyOptional({ description: '触发方式', enum: TriggerType, default: TriggerType.MANUAL })
  @IsOptional()
  @IsEnum(TriggerType)
  triggerType?: TriggerType;
}