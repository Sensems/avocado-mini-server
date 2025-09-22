import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MiniprogramStatus, User, UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RequirePermissions } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateMiniprogramDto } from './dto/create-miniprogram.dto';
import { UpdateMiniprogramDto } from './dto/update-miniprogram.dto';
import { MiniprogramsService } from './miniprograms.service';

@ApiTags('miniprograms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('miniprograms')
export class MiniprogramsController {
  constructor(private readonly miniprogramsService: MiniprogramsService) {}

  @Post()
  @RequirePermissions('miniprograms:create')
  @ApiOperation({ summary: '创建小程序' })
  @ApiResponse({ status: 201, description: '小程序创建成功' })
  @ApiResponse({ status: 409, description: 'AppID已存在' })
  create(@CurrentUser() user: User, @Body() createMiniprogramDto: CreateMiniprogramDto) {
    return this.miniprogramsService.create(user.id, createMiniprogramDto);
  }

  @Get()
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '获取小程序列表' })
  @ApiResponse({ status: 200, description: '获取小程序列表成功' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向' })
  findAll(@CurrentUser() user: User, @Query() paginationDto: PaginationDto) {
    // 普通用户只能查看自己的小程序，管理员可以查看所有
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.findAll(userId, paginationDto);
  }

  @Get('statistics')
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '获取小程序统计信息' })
  @ApiResponse({ status: 200, description: '获取统计信息成功' })
  getStatistics(@CurrentUser() user: User) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.getStatistics(userId);
  }

  @Get(':id')
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '根据ID获取小程序信息' })
  @ApiResponse({ status: 200, description: '获取小程序信息成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.findOne(id, userId);
  }

  @Get(':id/build-statistics')
  @RequirePermissions('miniprograms:read')
  @ApiOperation({ summary: '获取小程序构建统计信息' })
  @ApiResponse({ status: 200, description: '获取构建统计信息成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  getBuildStatistics(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.getBuildStatistics(id, userId);
  }

  @Patch(':id')
  @RequirePermissions('miniprograms:update')
  @ApiOperation({ summary: '更新小程序信息' })
  @ApiResponse({ status: 200, description: '小程序信息更新成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  @ApiResponse({ status: 409, description: 'AppID已存在' })
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMiniprogramDto: UpdateMiniprogramDto,
  ) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.update(id, updateMiniprogramDto, userId);
  }

  @Delete(':id')
  @RequirePermissions('miniprograms:delete')
  @ApiOperation({ summary: '删除小程序' })
  @ApiResponse({ status: 200, description: '小程序删除成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  @ApiResponse({ status: 400, description: '存在正在进行的构建任务，无法删除' })
  remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.remove(id, userId);
  }

  @Post('batch-update-status')
  @RequirePermissions('miniprograms:update')
  @ApiOperation({ summary: '批量更新小程序状态' })
  @ApiResponse({ status: 200, description: '小程序状态更新成功' })
  batchUpdateStatus(
    @CurrentUser() user: User,
    @Body() body: { ids: number[]; status: MiniprogramStatus },
  ) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.batchUpdateStatus(body.ids, body.status, userId);
  }

  @Post(':id/auto-increment-version')
  @RequirePermissions('miniprograms:update')
  @ApiOperation({ summary: '自动递增版本号' })
  @ApiResponse({ status: 200, description: '版本号更新成功' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  autoIncrementVersion(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.autoIncrementVersion(id, userId);
  }

  @Post(':id/upload-private-key')
  @RequirePermissions('miniprograms:update')
  @UseInterceptors(
    FileInterceptor('privateKey', {
      storage: diskStorage({
        destination: './uploads/private-keys',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${req.params.id}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.originalname.endsWith('.key') || 
            file.originalname.endsWith('.pem')) {
          callback(null, true);
        } else {
          callback(new Error('只允许上传 .key 或 .pem 格式的私钥文件'), false);
        }
      },
      limits: {
        fileSize: 1024 * 1024, // 1MB
      },
    }),
  )
  @ApiOperation({ summary: '上传小程序私钥文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '上传私钥文件',
    schema: {
      type: 'object',
      properties: {
        privateKey: {
          type: 'string',
          format: 'binary',
          description: '私钥文件 (.key 或 .pem 格式，最大1MB)',
        },
      },
      required: ['privateKey'],
    },
  })
  @ApiResponse({ status: 200, description: '私钥文件上传成功' })
  @ApiResponse({ status: 400, description: '文件格式不正确或文件过大' })
  @ApiResponse({ status: 404, description: '小程序不存在' })
  async uploadPrivateKey(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.miniprogramsService.uploadPrivateKey(id, file, userId);
  }
}