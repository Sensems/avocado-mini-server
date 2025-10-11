import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { CreateMiniprogramConfigDto } from './create-miniprogram-config.dto';

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

  @ApiProperty({ description: '私钥文件路径', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  privateKeyPath: string;

  @ApiPropertyOptional({ description: '当前版本号', default: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: '小程序描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Git认证凭据ID' })
  @IsOptional()
  @IsNumber()
  gitCredentialId?: string;

  @ApiPropertyOptional({ description: '通知配置ID列表' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  notificationConfigId?: string;

  @ApiProperty({ description: '小程序配置信息' })
  @ValidateNested()
  @Type(() => CreateMiniprogramConfigDto)
  config: CreateMiniprogramConfigDto;
}