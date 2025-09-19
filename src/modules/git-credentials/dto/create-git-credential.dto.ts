import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GitAuthType } from '@prisma/client';

export class CreateGitCredentialDto {
  @ApiProperty({ description: '凭据名称', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '认证类型', enum: GitAuthType })
  @IsEnum(GitAuthType)
  authType: GitAuthType;

  @ApiPropertyOptional({ description: '用户名（HTTPS认证时使用）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({ description: '密码（HTTPS认证时使用）' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @ApiPropertyOptional({ description: '访问令牌（TOKEN认证时使用）' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  token?: string;

  @ApiPropertyOptional({ description: 'SSH私钥（SSH认证时使用）' })
  @IsOptional()
  @IsString()
  sshKey?: string;

  @ApiPropertyOptional({ description: '凭据描述' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}