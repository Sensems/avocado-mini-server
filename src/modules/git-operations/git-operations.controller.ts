import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GitOperationService } from '../../common/services/git-operation.service';
import { 
  GetRepositoryBranchesDto, 
  GetRepositoryBranchesResponseDto 
} from '../../common/dto/git-operation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';

@ApiTags('git-operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('git-operations')
export class GitOperationsController {
  constructor(private readonly gitOperationService: GitOperationService) {}

  @Post('branches')
  @RequirePermissions('git-operations:read')
  @ApiOperation({ 
    summary: '获取Git仓库分支列表',
    description: '使用指定的凭证获取Git仓库的所有分支信息，包括分支名称、最后提交信息等'
  })
  @ApiResponse({ 
    status: 200, 
    description: '成功获取分支列表',
    type: GetRepositoryBranchesResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: '请求参数错误' 
  })
  @ApiResponse({ 
    status: 401, 
    description: '未授权访问' 
  })
  @ApiResponse({ 
    status: 403, 
    description: '权限不足' 
  })
  @ApiResponse({ 
    status: 404, 
    description: '凭证不存在' 
  })
  async getRepositoryBranches(
    @CurrentUser() user: User,
    @Body() dto: GetRepositoryBranchesDto,
  ): Promise<GetRepositoryBranchesResponseDto> {
    return this.gitOperationService.getRepositoryBranches(user.id, dto);
  }
}