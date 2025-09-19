import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { GitCredential, CredentialStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { UpdateGitCredentialDto } from './dto/update-git-credential.dto';
import { PaginationDto, PaginationResult } from '../../common/dto/pagination.dto';

@Injectable()
export class GitCredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建Git认证凭据
   */
  async create(userId: number, createGitCredentialDto: CreateGitCredentialDto): Promise<GitCredential> {
    // 检查名称是否已存在
    const existingCredential = await this.prisma.gitCredential.findFirst({
      where: {
        name: createGitCredentialDto.name,
        userId,
      },
    });

    if (existingCredential) {
      throw new ConflictException('该凭据名称已存在');
    }

    return this.prisma.gitCredential.create({
      data: {
        ...createGitCredentialDto,
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
   * 分页查询Git认证凭据列表
   */
  async findAll(
    userId: number,
    paginationDto?: PaginationDto,
  ): Promise<PaginationResult<GitCredential>> {
    const { page = 1, limit = 10, search, sortBy, sortOrder = 'desc' } = paginationDto || {};
    const skip = (page - 1) * limit;

    const where: Prisma.GitCredentialWhereInput = {
      userId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const orderBy: Prisma.GitCredentialOrderByWithRelationInput = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [credentials, total] = await Promise.all([
      this.prisma.gitCredential.findMany({
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
              miniprogramConfigs: true,
            },
          },
        },
      }),
      this.prisma.gitCredential.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: credentials,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 根据ID查询Git认证凭据
   */
  async findOne(id: number, userId: number): Promise<GitCredential> {
    const credential = await this.prisma.gitCredential.findFirst({
      where: {
        id,
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
        _count: {
          select: {
            miniprogramConfigs: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('Git认证凭据不存在');
    }

    return credential;
  }

  /**
   * 更新Git认证凭据
   */
  async update(
    id: number,
    userId: number,
    updateGitCredentialDto: UpdateGitCredentialDto,
  ): Promise<GitCredential> {
    // 检查凭据是否存在
    await this.findOne(id, userId);

    // 如果更新名称，检查是否已存在
    if (updateGitCredentialDto.name) {
      const existingCredential = await this.prisma.gitCredential.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { name: updateGitCredentialDto.name },
            { userId },
          ],
        },
      });

      if (existingCredential) {
        throw new ConflictException('该凭据名称已存在');
      }
    }

    return this.prisma.gitCredential.update({
      where: { id },
      data: updateGitCredentialDto,
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
   * 删除Git认证凭据
   */
  async remove(id: number, userId: number): Promise<void> {
    // 检查凭据是否存在
    await this.findOne(id, userId);

    // 检查是否有小程序在使用该凭据
    const usageCount = await this.prisma.miniprogramConfig.count({
      where: { gitCredentialId: id },
    });

    if (usageCount > 0) {
      throw new ConflictException('该凭据正在被小程序使用，无法删除');
    }

    await this.prisma.gitCredential.delete({
      where: { id },
    });
  }

  /**
   * 批量更新状态
   */
  async batchUpdateStatus(ids: number[], status: CredentialStatus, userId: number): Promise<void> {
    await this.prisma.gitCredential.updateMany({
      where: {
        id: { in: ids },
        userId,
      },
      data: { status },
    });
  }

  /**
   * 获取用户的所有可用凭据（用于下拉选择）
   */
  async findAvailableCredentials(userId: number): Promise<Pick<GitCredential, 'id' | 'name' | 'authType' | 'description'>[]> {
    return this.prisma.gitCredential.findMany({
      where: {
        userId,
        status: CredentialStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        authType: true,
        description: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}