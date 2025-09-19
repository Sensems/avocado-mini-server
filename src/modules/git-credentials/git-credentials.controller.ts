import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { User, CredentialStatus } from '@prisma/client';
import { GitCredentialsService } from './git-credentials.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { UpdateGitCredentialDto } from './dto/update-git-credential.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('git-credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('git-credentials')
export class GitCredentialsController {
  constructor(private readonly gitCredentialsService: GitCredentialsService) {}

  @Post()
  @RequirePermissions('git-credentials:create')
  @ApiOperation({ summary: '创建Git认证凭据' })
  @ApiResponse({ status: 201, description: 'Git认证凭据创建成功' })
  @ApiResponse({ status: 409, description: '凭据名称已存在' })
  create(@CurrentUser() user: User, @Body() createGitCredentialDto: CreateGitCredentialDto) {
    return this.gitCredentialsService.create(user.id, createGitCredentialDto);
  }

  @Get()
  @RequirePermissions('git-credentials:read')
  @ApiOperation({ summary: '获取Git认证凭据列表' })
  @ApiResponse({ status: 200, description: '获取Git认证凭据列表成功' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向' })
  findAll(@CurrentUser() user: User, @Query() paginationDto: PaginationDto) {
    return this.gitCredentialsService.findAll(user.id, paginationDto);
  }

  @Get('available')
  @RequirePermissions('git-credentials:read')
  @ApiOperation({ summary: '获取可用的Git认证凭据（用于下拉选择）' })
  @ApiResponse({ status: 200, description: '获取可用凭据成功' })
  findAvailable(@CurrentUser() user: User) {
    return this.gitCredentialsService.findAvailableCredentials(user.id);
  }

  @Get(':id')
  @RequirePermissions('git-credentials:read')
  @ApiOperation({ summary: '根据ID获取Git认证凭据信息' })
  @ApiResponse({ status: 200, description: '获取Git认证凭据信息成功' })
  @ApiResponse({ status: 404, description: 'Git认证凭据不存在' })
  findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.gitCredentialsService.findOne(id, user.id);
  }

  @Patch(':id')
  @RequirePermissions('git-credentials:update')
  @ApiOperation({ summary: '更新Git认证凭据信息' })
  @ApiResponse({ status: 200, description: 'Git认证凭据信息更新成功' })
  @ApiResponse({ status: 404, description: 'Git认证凭据不存在' })
  @ApiResponse({ status: 409, description: '凭据名称已存在' })
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateGitCredentialDto: UpdateGitCredentialDto,
  ) {
    return this.gitCredentialsService.update(id, user.id, updateGitCredentialDto);
  }

  @Delete(':id')
  @RequirePermissions('git-credentials:delete')
  @ApiOperation({ summary: '删除Git认证凭据' })
  @ApiResponse({ status: 200, description: 'Git认证凭据删除成功' })
  @ApiResponse({ status: 404, description: 'Git认证凭据不存在' })
  @ApiResponse({ status: 400, description: '凭据正在被使用，无法删除' })
  remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.gitCredentialsService.remove(id, user.id);
  }

  @Post('batch-update-status')
  @RequirePermissions('git-credentials:update')
  @ApiOperation({ summary: '批量更新Git认证凭据状态' })
  @ApiResponse({ status: 200, description: 'Git认证凭据状态更新成功' })
  batchUpdateStatus(
    @CurrentUser() user: User,
    @Body() body: { ids: number[]; status: CredentialStatus },
  ) {
    return this.gitCredentialsService.batchUpdateStatus(body.ids, body.status, user.id);
  }
}