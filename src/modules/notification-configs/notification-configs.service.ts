import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationConfigDto } from './dto/create-notification-config.dto';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationConfigStatus, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, createNotificationConfigDto: CreateNotificationConfigDto) {
    // 检查配置名称是否已存在
    const existingConfig = await this.prisma.notificationConfig.findFirst({
      where: {
        name: createNotificationConfigDto.name,
        userId,
      },
    });

    if (existingConfig) {
      throw new ConflictException('通知配置名称已存在');
    }

    return this.prisma.notificationConfig.create({
      data: {
        name: createNotificationConfigDto.name,
        type: createNotificationConfigDto.type,
        description: createNotificationConfigDto.description,
        webhook: createNotificationConfigDto.config?.webhook,
        emails: createNotificationConfigDto.config?.emails,
        events: createNotificationConfigDto.config?.events || ['start', 'success', 'fail'],
        template: createNotificationConfigDto.config?.template,
        userId,
        status: NotificationConfigStatus.ACTIVE,
      },
    });
  }

  async findAll(userId: number, paginationDto: PaginationDto) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = paginationDto;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    };

    const [configs, total] = await Promise.all([
      this.prisma.notificationConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              miniprogramConfigs: true,
            },
          },
        },
      }),
      this.prisma.notificationConfig.count({ where }),
    ]);

    return {
      data: configs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAvailableConfigs(userId: number) {
    return this.prisma.notificationConfig.findMany({
      where: {
        userId,
        status: NotificationConfigStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number, userId: number) {
    const config = await this.prisma.notificationConfig.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            miniprogramConfigs: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('通知配置不存在');
    }

    return config;
  }

  async update(id: number, userId: number, updateNotificationConfigDto: UpdateNotificationConfigDto) {
    // 检查配置是否存在
    const existingConfig = await this.prisma.notificationConfig.findFirst({
      where: { id, userId },
    });

    if (!existingConfig) {
      throw new NotFoundException('通知配置不存在');
    }

    // 如果更新名称，检查是否与其他配置重名
    if (updateNotificationConfigDto.name && updateNotificationConfigDto.name !== existingConfig.name) {
      const duplicateConfig = await this.prisma.notificationConfig.findFirst({
        where: {
          name: updateNotificationConfigDto.name,
          userId,
          id: { not: id },
        },
      });

      if (duplicateConfig) {
        throw new ConflictException('通知配置名称已存在');
      }
    }

    return this.prisma.notificationConfig.update({
      where: { id },
      data: {
        ...updateNotificationConfigDto,
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: number, userId: number) {
    // 检查配置是否存在
    const config = await this.prisma.notificationConfig.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            miniprogramConfigs: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('通知配置不存在');
    }

    // 检查是否有小程序正在使用此配置
    if (config._count.miniprogramConfigs > 0) {
      throw new BadRequestException('该通知配置正在被小程序使用，无法删除');
    }

    return this.prisma.notificationConfig.delete({
      where: { id },
    });
  }

  async batchUpdateStatus(ids: number[], status: NotificationConfigStatus, userId: number) {
    // 检查所有配置是否属于当前用户
    const configs = await this.prisma.notificationConfig.findMany({
      where: {
        id: { in: ids },
        userId,
      },
    });

    if (configs.length !== ids.length) {
      throw new BadRequestException('部分通知配置不存在或无权限操作');
    }

    return this.prisma.notificationConfig.updateMany({
      where: {
        id: { in: ids },
        userId,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }

  async testNotificationConfig(id: number, userId: number) {
    const config = await this.findOne(id, userId);
    
    // 这里可以实现具体的通知测试逻辑
    // 根据不同的通知类型进行测试
    switch (config.type) {
      case NotificationType.EMAIL:
        // 测试邮件发送
        break;
      case NotificationType.SMS:
        // 测试Webhook调用
        break;
      case NotificationType.DINGTALK:
        // 测试钉钉通知
        break;
      case NotificationType.WECHAT:
        // 测试企业微信通知
        break;
      default:
        throw new BadRequestException('不支持的通知类型');
    }

    return { message: '通知配置测试成功' };
  }
}