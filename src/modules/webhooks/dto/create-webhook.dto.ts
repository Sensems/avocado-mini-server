import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsUrl, IsEnum, IsBoolean } from 'class-validator';

export enum WebhookEvent {
  PUSH = 'push',
  PULL_REQUEST = 'pull_request',
  RELEASE = 'release',
  TAG = 'tag',
}

export class CreateWebhookDto {
  @ApiProperty({ description: 'Webhook URL', required: false })
  @IsOptional()
  @IsUrl({}, { message: 'URL格式不正确' })
  url: string;

  @ApiProperty({ description: 'Webhook 密钥', required: false })
  @IsOptional()
  @IsString()
  secret: string;

  @ApiProperty({ 
    description: '监听的事件类型', 
    enum: WebhookEvent,
    isArray: true,
    example: [WebhookEvent.PUSH, WebhookEvent.PULL_REQUEST]
  })
  @IsArray()
  @IsEnum(WebhookEvent, { each: true, message: '事件类型不正确' })
  events: WebhookEvent[];

  @ApiProperty({ description: '小程序ID' })
  @IsString()
  appId: string;
}