import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestDingtalkDto {
  @ApiProperty({ 
    description: '钉钉 Webhook URL',
    example: 'https://oapi.dingtalk.com/robot/send?access_token=xxx'
  })
  @IsString()
  @IsUrl()
  webhook: string;

  @ApiPropertyOptional({ 
    description: '钉钉机器人密钥（可选）',
    example: 'SECxxx'
  })
  @IsOptional()
  @IsString()
  secret?: string;
}