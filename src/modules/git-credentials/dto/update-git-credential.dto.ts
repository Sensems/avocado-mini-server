import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GitAuthType, CredentialStatus } from '@prisma/client';

export class UpdateGitCredentialDto {
  @ApiPropertyOptional({ description: '凭据名称' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '认证类型', enum: GitAuthType })
  @IsOptional()
  @IsEnum(GitAuthType)
  authType?: GitAuthType;

  @ApiPropertyOptional({ description: '用户名' })
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: '密码' })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ description: '访问令牌' })
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({ description: 'SSH私钥' })
  @IsOptional()
  sshKey?: string;

  @ApiPropertyOptional({ description: '凭据描述' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '状态', enum: CredentialStatus })
  @IsOptional()
  @IsEnum(CredentialStatus)
  status?: CredentialStatus;
}