import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateWebhookDto {
  @ApiProperty({ description: '小程序ID' })
  @IsString()
  appId: string;
}