import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

/**
 * 获取仓库分支请求DTO
 */
export class GetRepositoryBranchesDto {
  @ApiProperty({ 
    description: '仓库URL',
    example: 'https://github.com/username/repository.git'
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  repositoryUrl: string;

  @ApiProperty({ 
    description: 'Git凭证ID',
    example: 1
  })
  @IsNotEmpty()
  credentialId: number;
}

/**
 * 仓库分支信息
 */
export class RepositoryBranch {
  @ApiProperty({ description: '分支名称' })
  name: string;

  @ApiProperty({ description: '最后提交SHA' })
  lastCommitSha: string;

  @ApiProperty({ description: '最后提交时间' })
  lastCommitDate: Date;
}

/**
 * 获取仓库分支响应DTO
 */
export class GetRepositoryBranchesResponseDto {
  @ApiProperty({ description: '是否成功' })
  success: boolean;

  @ApiProperty({ 
    description: '分支列表',
    type: [RepositoryBranch]
  })
  branches: RepositoryBranch[];

  @ApiProperty({ description: '默认分支名称' })
  defaultBranch: string;

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string;
}

/**
 * Git操作错误类型
 */
export enum GitOperationErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  REPOSITORY_NOT_FOUND = 'REPOSITORY_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_URL = 'INVALID_URL',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Git操作异常
 */
export class GitOperationException extends Error {
  constructor(
    public readonly type: GitOperationErrorType,
    public readonly message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'GitOperationException';
  }
}