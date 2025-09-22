import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { GitCredential, CredentialStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { UpdateGitCredentialDto } from './dto/update-git-credential.dto';
import { PaginationDto, PaginationResult } from '../../common/dto/pagination.dto';

@Injectable()
export class GitCredentialsService {
  // 定义需要加密的敏感字段
  private readonly sensitiveFields = ['password', 'token', 'sshKey'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * 创建Git认证凭据
   */
  async create(userId: number, createGitCredentialDto: CreateGitCredentialDto): Promise<Omit<GitCredential, 'password' | 'token' | 'sshKey'>> {
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

    // 加密敏感字段
    const encryptedData = this.encryptionService.encryptSensitiveFields(
      createGitCredentialDto,
      this.sensitiveFields,
    );

    return this.prisma.gitCredential.create({
      data: {
        ...encryptedData,
        userId,
      } as any,
      select: {
        id: true,
        name: true,
        authType: true,
        username: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
      // include: {
      //   user: {
      //     select: {
      //       id: true,
      //       username: true,
      //       nickname: true,
      //     },
      //   },
      // },
    });
  }

  /**
   * 分页查询Git认证凭据列表
   */
  async findAll(
    userId: number,
    paginationDto?: PaginationDto,
  ): Promise<PaginationResult<Omit<GitCredential, 'password' | 'token' | 'sshKey'>>> {
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
        select: {
          id: true,
          name: true,
          authType: true,
          username: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
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
  async findOne(id: number, userId: number): Promise<Omit<GitCredential, 'password' | 'token' | 'sshKey'>> {
    const credential = await this.prisma.gitCredential.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
        name: true,
        authType: true,
        username: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
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
  ): Promise<Omit<GitCredential, 'password' | 'token' | 'sshKey'>> {
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

    // 加密敏感字段（只加密提供的字段）
    const encryptedData = this.encryptionService.encryptSensitiveFields(
      updateGitCredentialDto,
      this.sensitiveFields,
    );

    return this.prisma.gitCredential.update({
      where: { id },
      data: encryptedData,
      select: {
        id: true,
        name: true,
        authType: true,
        username: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
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

  /**
   * 内部方法：获取完整的凭据信息（包含敏感字段）
   * 仅用于需要访问敏感字段的内部方法
   */
  private async findOneWithSensitiveFields(id: number, userId: number): Promise<GitCredential> {
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
   * 获取解密后的凭据信息（用于实际使用，如Git操作）
   * 注意：此方法返回明文敏感信息，应谨慎使用
   */
  async getDecryptedCredential(id: number, userId: number): Promise<GitCredential & { decryptedPassword?: string; decryptedToken?: string; decryptedSshKey?: string }> {
    const credential = await this.findOneWithSensitiveFields(id, userId);
    
    // 解密敏感字段
    const decryptedCredential = {
      ...credential,
      decryptedPassword: credential.password ? this.encryptionService.decryptSensitiveData(credential.password) : undefined,
      decryptedToken: credential.token ? this.encryptionService.decryptSensitiveData(credential.token) : undefined,
      decryptedSshKey: credential.sshKey ? this.encryptionService.decryptSensitiveData(credential.sshKey) : undefined,
    };

    return decryptedCredential;
  }

  /**
   * 验证凭据是否可用（解密测试）
   */
  async validateCredential(id: number, userId: number): Promise<{ isValid: boolean; error?: string }> {
    try {
      const credential = await this.findOneWithSensitiveFields(id, userId);
      
      // 尝试解密所有敏感字段以验证数据完整性
      if (credential.password) {
        this.encryptionService.decryptSensitiveData(credential.password);
      }
      if (credential.token) {
        this.encryptionService.decryptSensitiveData(credential.token);
      }
      if (credential.sshKey) {
        this.encryptionService.decryptSensitiveData(credential.sshKey);
      }

      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: error.message || '凭据验证失败' 
      };
    }
  }
}