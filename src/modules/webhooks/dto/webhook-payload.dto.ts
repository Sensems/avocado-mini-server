import { IsString, IsObject, IsOptional, IsArray, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GitCommit {
  @ApiProperty({ description: '提交ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '提交消息' })
  @IsString()
  message: string;

  @ApiProperty({ description: '提交作者' })
  @IsObject()
  author: {
    name: string;
    email: string;
    username?: string;
  };

  @ApiProperty({ description: '提交时间' })
  @IsString()
  timestamp: string;

  @ApiProperty({ description: '提交URL' })
  @IsString()
  url: string;

  @ApiProperty({ description: '新增文件', required: false })
  @IsOptional()
  @IsArray()
  added?: string[];

  @ApiProperty({ description: '修改文件', required: false })
  @IsOptional()
  @IsArray()
  modified?: string[];

  @ApiProperty({ description: '删除文件', required: false })
  @IsOptional()
  @IsArray()
  removed?: string[];
}

export class GitRepository {
  @ApiProperty({ description: '仓库ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ description: '仓库名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '仓库全名' })
  @IsString()
  full_name: string;

  @ApiProperty({ description: '仓库URL' })
  @IsString()
  html_url: string;

  @ApiProperty({ description: '克隆URL' })
  @IsString()
  clone_url: string;

  @ApiProperty({ description: '默认分支' })
  @IsString()
  default_branch: string;
}

export class GitPullRequest {
  @ApiProperty({ description: 'PR ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ description: 'PR 编号' })
  @IsNumber()
  number: number;

  @ApiProperty({ description: 'PR 标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'PR 状态' })
  @IsString()
  state: string;

  @ApiProperty({ description: '是否已合并' })
  @IsBoolean()
  merged: boolean;

  @ApiProperty({ description: '源分支' })
  @IsString()
  head_ref: string;

  @ApiProperty({ description: '目标分支' })
  @IsString()
  base_ref: string;

  @ApiProperty({ description: 'PR 作者' })
  @IsObject()
  user: {
    login: string;
    id: number;
  };
}

// GitHub Push Event Payload
export class GitHubPushPayload {
  @ApiProperty({ description: '引用' })
  @IsString()
  ref: string;

  @ApiProperty({ description: '推送前的提交ID' })
  @IsString()
  before: string;

  @ApiProperty({ description: '推送后的提交ID' })
  @IsString()
  after: string;

  @ApiProperty({ description: '仓库信息' })
  @IsObject()
  repository: GitRepository;

  @ApiProperty({ description: '提交列表' })
  @IsArray()
  commits: GitCommit[];

  @ApiProperty({ description: '推送者' })
  @IsObject()
  pusher: {
    name: string;
    email: string;
  };

  @ApiProperty({ description: '是否强制推送' })
  @IsBoolean()
  forced: boolean;

  @ApiProperty({ description: '是否创建分支' })
  @IsBoolean()
  created: boolean;

  @ApiProperty({ description: '是否删除分支' })
  @IsBoolean()
  deleted: boolean;
}

// GitHub Pull Request Event Payload
export class GitHubPullRequestPayload {
  @ApiProperty({ description: '动作类型' })
  @IsString()
  action: string;

  @ApiProperty({ description: 'PR 信息' })
  @IsObject()
  pull_request: GitPullRequest;

  @ApiProperty({ description: '仓库信息' })
  @IsObject()
  repository: GitRepository;
}

// GitLab Push Event Payload
export class GitLabPushPayload {
  @ApiProperty({ description: '事件名称' })
  @IsString()
  event_name: string;

  @ApiProperty({ description: '推送前的提交ID' })
  @IsString()
  before: string;

  @ApiProperty({ description: '推送后的提交ID' })
  @IsString()
  after: string;

  @ApiProperty({ description: '引用' })
  @IsString()
  ref: string;

  @ApiProperty({ description: '用户ID' })
  @IsNumber()
  user_id: number;

  @ApiProperty({ description: '用户名' })
  @IsString()
  user_name: string;

  @ApiProperty({ description: '用户邮箱' })
  @IsString()
  user_email: string;

  @ApiProperty({ description: '项目ID' })
  @IsNumber()
  project_id: number;

  @ApiProperty({ description: '项目信息' })
  @IsObject()
  project: {
    id: number;
    name: string;
    description: string;
    web_url: string;
    git_ssh_url: string;
    git_http_url: string;
    namespace: string;
    default_branch: string;
  };

  @ApiProperty({ description: '提交列表' })
  @IsArray()
  commits: GitCommit[];

  @ApiProperty({ description: '总提交数' })
  @IsNumber()
  total_commits_count: number;
}

// 通用 Webhook 负载
export class WebhookPayloadDto {
  @ApiProperty({ description: 'Webhook 事件类型' })
  @IsString()
  event: string;

  @ApiProperty({ description: '事件负载' })
  @IsObject()
  payload: GitHubPushPayload | GitHubPullRequestPayload | GitLabPushPayload | any;

  @ApiProperty({ description: 'Webhook 签名', required: false })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiProperty({ description: '事件ID', required: false })
  @IsOptional()
  @IsString()
  delivery?: string;
}