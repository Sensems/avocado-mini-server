import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Miniprogram, MiniprogramStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMiniprogramDto } from './dto/create-miniprogram.dto';
import { UpdateMiniprogramDto } from './dto/update-miniprogram.dto';
import { PaginationDto, PaginationResult } from '../../common/dto/pagination.dto';

@Injectable()
export class MiniprogramsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建小程序
   */
  async create(userId: number, createMiniprogramDto: CreateMiniprogramDto): Promise<Miniprogram> {
    // 检查AppID是否已存在
    const existingMiniprogram = await this.prisma.miniprogram.findUnique({
      where: { appId: createMiniprogramDto.appId },
    });

    if (existingMiniprogram) {
      throw new ConflictException('该AppID已存在');
    }

    return this.prisma.miniprogram.create({
      data: {
        ...createMiniprogramDto,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });
  }

  /**
   * 分页查询小程序列表
   */
  async findAll(
    userId?: number,
    paginationDto?: PaginationDto,
  ): Promise<PaginationResult<Miniprogram>> {
    const { page = 1, limit = 10, search, sortBy, sortOrder = 'desc' } = paginationDto || {};
    const skip = (page - 1) * limit;

    const where: Prisma.MiniprogramWhereInput = {};

    // 如果指定了用户ID，只查询该用户的小程序
    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { appId: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const orderBy: Prisma.MiniprogramOrderByWithRelationInput = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [miniprograms, total] = await Promise.all([
      this.prisma.miniprogram.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
          _count: {
            select: {
              buildTasks: true,
            },
          },
        },
      }),
      this.prisma.miniprogram.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: miniprograms,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 根据ID查询小程序
   */
  async findOne(id: number, userId?: number): Promise<Miniprogram> {
    const where: Prisma.MiniprogramWhereInput = { id };
    
    // 如果指定了用户ID，只能查询自己的小程序
    if (userId) {
      where.userId = userId;
    }

    const miniprogram = await this.prisma.miniprogram.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
        _count: {
          select: {
            buildTasks: true,
          },
        },
      },
    });

    if (!miniprogram) {
      throw new NotFoundException('小程序不存在');
    }

    return miniprogram;
  }

  /**
   * 根据AppID查询小程序
   */
  async findByAppId(appId: string): Promise<Miniprogram | null> {
    return this.prisma.miniprogram.findUnique({
      where: { appId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });
  }

  /**
   * 更新小程序信息
   */
  async update(
    id: number,
    updateMiniprogramDto: UpdateMiniprogramDto,
    userId?: number,
  ): Promise<Miniprogram> {
    // 检查小程序是否存在
    await this.findOne(id, userId);

    // 如果更新AppID，检查是否已存在
    if (updateMiniprogramDto.appId) {
      const existingMiniprogram = await this.prisma.miniprogram.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { appId: updateMiniprogramDto.appId },
          ],
        },
      });

      if (existingMiniprogram) {
        throw new ConflictException('该AppID已存在');
      }
    }

    const where: Prisma.MiniprogramWhereInput = { id };
    if (userId) {
      where.userId = userId;
    }

    return this.prisma.miniprogram.update({
      where: { id },
      data: updateMiniprogramDto,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });
  }

  /**
   * 删除小程序
   */
  async remove(id: number, userId?: number): Promise<void> {
    // 检查小程序是否存在
    await this.findOne(id, userId);

    // 检查是否有正在进行的构建任务
    const runningTasks = await this.prisma.buildTask.findMany({
      where: {
        appId: id,
        status: {
          in: ['PENDING', 'RUNNING'],
        },
      },
    });

    if (runningTasks.length > 0) {
      throw new BadRequestException('存在正在进行的构建任务，无法删除');
    }

    const where: Prisma.MiniprogramWhereInput = { id };
    if (userId) {
      where.userId = userId;
    }

    await this.prisma.miniprogram.delete({
      where: { id },
    });
  }

  /**
   * 批量更新小程序状态
   */
  async batchUpdateStatus(ids: number[], status: MiniprogramStatus, userId?: number): Promise<void> {
    const where: Prisma.MiniprogramWhereInput = { id: { in: ids } };
    if (userId) {
      where.userId = userId;
    }

    await this.prisma.miniprogram.updateMany({
      where,
      data: { status },
    });
  }

  /**
   * 获取小程序统计信息
   */
  async getStatistics(userId?: number): Promise<Record<string, any>> {
    const where: Prisma.MiniprogramWhereInput = {};
    if (userId) {
      where.userId = userId;
    }

    const [total, active, inactive, archived] = await Promise.all([
      this.prisma.miniprogram.count({ where }),
      this.prisma.miniprogram.count({ where: { ...where, status: MiniprogramStatus.ACTIVE } }),
      this.prisma.miniprogram.count({ where: { ...where, status: MiniprogramStatus.INACTIVE } }),
      this.prisma.miniprogram.count({ where: { ...where, status: MiniprogramStatus.ARCHIVED } }),
    ]);

    return {
      total,
      active,
      inactive,
      archived,
    };
  }

  /**
   * 获取小程序的构建历史统计
   */
  async getBuildStatistics(id: number, userId?: number): Promise<Record<string, any>> {
    // 检查小程序是否存在
    await this.findOne(id, userId);

    const [totalBuilds, successBuilds, failedBuilds, pendingBuilds] = await Promise.all([
      this.prisma.buildTask.count({ where: { appId: id } }),
      this.prisma.buildTask.count({ where: { appId: id, status: 'SUCCESS' } }),
      this.prisma.buildTask.count({ where: { appId: id, status: 'FAILED' } }),
      this.prisma.buildTask.count({ where: { appId: id, status: { in: ['PENDING', 'RUNNING'] } } }),
    ]);

    // 获取最近的构建任务
    const recentBuilds = await this.prisma.buildTask.findMany({
      where: { appId: id },
      orderBy: { createTime: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        version: true,
        createTime: true,
        duration: true,
      },
    });

    return {
      totalBuilds,
      successBuilds,
      failedBuilds,
      pendingBuilds,
      successRate: totalBuilds > 0 ? Math.round((successBuilds / totalBuilds) * 100) : 0,
      recentBuilds,
    };
  }

  /**
   * 更新小程序版本号
   */
  async updateVersion(id: number, version: string, userId?: number): Promise<void> {
    const where: Prisma.MiniprogramWhereInput = { id };
    if (userId) {
      where.userId = userId;
    }

    await this.prisma.miniprogram.update({
      where: { id },
      data: { version },
    });
  }

  /**
   * 自动递增版本号
   */
  async autoIncrementVersion(id: number, userId?: number): Promise<string> {
    const miniprogram = await this.findOne(id, userId);
    
    if (!miniprogram.autoVersion) {
      return miniprogram.version;
    }

    // 简单的版本号递增逻辑 (x.y.z -> x.y.z+1)
    const versionParts = miniprogram.version.split('.');
    if (versionParts.length === 3) {
      const patch = parseInt(versionParts[2], 10) + 1;
      const newVersion = `${versionParts[0]}.${versionParts[1]}.${patch}`;
      
      await this.updateVersion(id, newVersion, userId);
      return newVersion;
    }

    return miniprogram.version;
  }
}