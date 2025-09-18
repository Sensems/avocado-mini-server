import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MiniprogramStatus } from '@prisma/client';
import { CreateMiniprogramDto } from './create-miniprogram.dto';

export class UpdateMiniprogramDto extends PartialType(CreateMiniprogramDto) {
  @ApiPropertyOptional({ description: '小程序状态', enum: MiniprogramStatus })
  @IsOptional()
  @IsEnum(MiniprogramStatus)
  status?: MiniprogramStatus;
}