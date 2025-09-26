import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class BuildTaskQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: '小程序ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  appId?: number;
}