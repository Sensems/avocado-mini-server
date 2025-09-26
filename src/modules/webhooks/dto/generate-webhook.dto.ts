import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateWebhookDto {
  @ApiProperty({ description: '小程序ID' })
  @IsNumber({}, { message: '小程序ID必须是数字' })
  appId: number;
}