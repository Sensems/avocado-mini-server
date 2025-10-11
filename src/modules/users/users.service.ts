import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { User, UserStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginationResult } from '../../common/dto/pagination.dto';

// 定义不包含密码的用户类型
export type UserWithoutPassword = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建用户
   */
  async create(createUserDto: CreateUserDto): Promise<UserWithoutPassword> {
    const { password, ...userData } = createUserDto;

    // 检查用户名和邮箱是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: userData.username },
          { email: userData.email },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === userData.username) {
        throw new ConflictException('用户名已存在');
      }
      if (existingUser.email === userData.email) {
        throw new ConflictException('邮箱已存在');
      }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatar: true,
        phone: true,
        status: true,
        role: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 分页查询用户列表
   */
  async findAll(paginationDto: PaginationDto): Promise<PaginationResult<UserWithoutPassword>> {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
        { nickname: { contains: search } },
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          username: true,
          email: true,
          nickname: true,
          avatar: true,
          phone: true,
          status: true,
          role: true,
          permissions: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 根据ID查询用户
   */
  async findOne(id: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatar: true,
        phone: true,
        status: true,
        role: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 根据用户名查询用户（包含密码，用于认证）
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * 根据邮箱查询用户
   */
  async findByEmail(email: string): Promise<UserWithoutPassword | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatar: true,
        phone: true,
        status: true,
        role: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 更新用户信息
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserWithoutPassword> {
    const { password, ...userData } = updateUserDto;

    // 检查用户是否存在
    await this.findOne(id);

    // 如果更新用户名或邮箱，检查是否已存在
    if (userData.username || userData.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                userData.username ? { username: userData.username } : {},
                userData.email ? { email: userData.email } : {},
              ].filter(obj => Object.keys(obj).length > 0),
            },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.username === userData.username) {
          throw new ConflictException('用户名已存在');
        }
        if (existingUser.email === userData.email) {
          throw new ConflictException('邮箱已存在');
        }
      }
    }

    const updateData: any = { ...userData };

    // 如果更新密码，需要加密
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatar: true,
        phone: true,
        status: true,
        role: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 删除用户
   */
  async remove(id: string): Promise<void> {
    // 检查用户是否存在
    await this.findOne(id);

    // 检查用户是否有关联的小程序或构建任务
    const userWithRelations = await this.prisma.user.findUnique({
      where: { id },
      include: {
        miniprograms: true,
        buildTasks: true,
      },
    });

    if (userWithRelations?.miniprograms.length > 0) {
      throw new BadRequestException('用户存在关联的小程序，无法删除');
    }

    if (userWithRelations?.buildTasks.length > 0) {
      throw new BadRequestException('用户存在关联的构建任务，无法删除');
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLoginAt(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * 验证密码
   */
  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * 修改密码
   */
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isOldPasswordValid = await this.validatePassword(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedNewPassword },
    });
  }

  /**
   * 重置密码
   */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  /**
   * 批量更新用户状态
   */
  async batchUpdateStatus(ids: string[], status: UserStatus): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
  }
}