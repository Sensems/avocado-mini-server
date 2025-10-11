import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BuildTask, TaskStatus, Prisma, User, UserRole, BuildType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { MiniprogramsService } from '../miniprograms/miniprograms.service';
import { CreateBuildTaskDto } from './dto/create-build-task.dto';
import { PaginationDto, PaginationResult } from '../../common/dto/pagination.dto';

export interface BuildJobData {
  taskId: string;
  appId: string;
  type: BuildType;
  branch: string;
  version: string;
  description?: string;
  operator: string;
}

@Injectable()
export class BuildTasksService {
  private readonly logger = new Logger(BuildTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly miniprogramsService: MiniprogramsService,
    @InjectQueue('build') private readonly buildQueue: Queue,
  ) {}

  /**
   * 创建构建任务
   */
  async create(userId: string, createBuildTaskDto: CreateBuildTaskDto): Promise<BuildTask> {
    const { appId, ...taskData } = createBuildTaskDto;

    // 检查小程序是否存在
    const miniprogram = await this.miniprogramsService.findOne(appId);
    if (!miniprogram) {
      throw new NotFoundException('小程序不存在');
    }

    // 检查当前用户是否有权限操作该小程序
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== UserRole.ADMIN && miniprogram.userId !== userId) {
      throw new BadRequestException('无权限操作该小程序');
    }

    // 检查是否有正在进行的同类型任务
    const runningTask = await this.prisma.buildTask.findFirst({
      where: {
        appId,
        type: taskData.type,
        status: {
          in: [TaskStatus.PENDING, TaskStatus.RUNNING],
        },
      },
    });

    if (runningTask) {
      throw new BadRequestException('该小程序已有正在进行的同类型构建任务');
    }

    // 检查队列长度
    const queueSize = await this.buildQueue.count();
    const maxQueueSize = 200; // 从配置中获取
    
    if (queueSize >= maxQueueSize) {
      throw new BadRequestException('构建队列已满，请稍后再试');
    }

    const taskId = uuidv4();

    // 创建构建任务记录
    const buildTask = await this.prisma.buildTask.create({
      data: {
        id: taskId,
        appId,
        userId,
        ...taskData,
        status: TaskStatus.PENDING,
        createTime: new Date(),
      },
      include: {
        miniprogram: {
          select: {
            id: true,
            name: true,
            appId: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });

    // 添加到构建队列
    const jobData: BuildJobData = {
      taskId,
      appId,
      type: taskData.type,
      branch: taskData.branch,
      version: taskData.version,
      description: taskData.description,
      operator: taskData.operator,
    };

    await this.buildQueue.add('build-miniprogram', jobData, {
      priority: taskData.priority || 2,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 10,
    });

    this.logger.log(`Build task ${taskId} created and added to queue`);

    return buildTask;
  }

  /**
   * 分页查询构建任务列表
   */
  async findAll(
    userId?: string,
    appId?: string,
    paginationDto?: PaginationDto,
  ): Promise<PaginationResult<BuildTask>> {
    const { page = 1, limit = 10, search, sortBy, sortOrder = 'desc' } = paginationDto || {};
    const skip = (page - 1) * limit;

    const where: Prisma.BuildTaskWhereInput = {};

    // 如果指定了用户ID，只查询该用户的构建任务
    if (userId) {
      where.userId = userId;
    }

    // 如果指定了小程序ID，只查询该小程序的构建任务
    if (appId) {
      where.appId = appId;
    }

    if (search) {
      where.OR = [
        { id: { contains: search } },
        { version: { contains: search } },
        { description: { contains: search } },
        { operator: { contains: search } },
        { branch: { contains: search } },
      ];
    }

    const orderBy: Prisma.BuildTaskOrderByWithRelationInput = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createTime = 'desc';
    }

    const [buildTasks, total] = await Promise.all([
      this.prisma.buildTask.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          miniprogram: {
            select: {
              id: true,
              name: true,
              appId: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      }),
      this.prisma.buildTask.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: buildTasks,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 根据ID查询构建任务
   */
  async findOne(id: string, userId?: string): Promise<BuildTask> {
    const where: Prisma.BuildTaskWhereInput = { id };
    
    // 如果指定了用户ID，只能查询自己的构建任务
    if (userId) {
      where.userId = userId;
    }

    const buildTask = await this.prisma.buildTask.findFirst({
      where,
      include: {
        miniprogram: {
          select: {
            id: true,
            name: true,
            appId: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });

    if (!buildTask) {
      throw new NotFoundException('构建任务不存在');
    }

    return buildTask;
  }

  /**
   * 更新构建任务状态
   */
  async updateStatus(
    id: string,
    status: TaskStatus,
    data?: Partial<BuildTask>,
  ): Promise<BuildTask> {
    const updateData: any = { status };

    if (status === TaskStatus.RUNNING && !data?.startTime) {
      updateData.startTime = new Date();
    }

    if (status === TaskStatus.SUCCESS || status === TaskStatus.FAILED) {
      updateData.endTime = new Date();
      
      // 计算耗时
      const task = await this.prisma.buildTask.findUnique({ where: { id } });
      if (task?.startTime) {
        updateData.duration = Math.floor(
          (updateData.endTime.getTime() - task.startTime.getTime()) / 1000,
        );
      }
    }

    // 合并其他更新数据
    if (data) {
      Object.assign(updateData, data);
    }

    return this.prisma.buildTask.update({
      where: { id },
      data: updateData,
      include: {
        miniprogram: {
          select: {
            id: true,
            name: true,
            appId: true,
          },
        },
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
   * 更新构建进度
   */
  async updateProgress(id: string, progress: number): Promise<void> {
    await this.prisma.buildTask.update({
      where: { id },
      data: { progress: Math.min(100, Math.max(0, progress)) },
    });
  }

  /**
   * 添加构建日志
   */
  async appendLog(id: string, log: string): Promise<void> {
    const task = await this.prisma.buildTask.findUnique({ where: { id } });
    const currentLog = task?.buildLog || '';
    const newLog = currentLog + log + '\n';

    await this.prisma.buildTask.update({
      where: { id },
      data: { buildLog: newLog },
    });
  }

  /**
   * 取消构建任务
   */
  async cancel(id: string, userId?: string): Promise<BuildTask> {
    const task = await this.findOne(id, userId);

    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.RUNNING) {
      throw new BadRequestException('只能取消等待中或运行中的任务');
    }

    // 从队列中移除任务
    const jobs = await this.buildQueue.getJobs(['waiting', 'active']);
    const job = jobs.find(j => j.data.taskId === id);
    if (job) {
      await job.remove();
    }

    return this.updateStatus(id, TaskStatus.CANCELLED);
  }

  /**
   * 重试构建任务
   */
  async retry(id: string, userId?: string): Promise<BuildTask> {
    const task = await this.findOne(id, userId);

    if (task.status !== TaskStatus.FAILED) {
      throw new BadRequestException('只能重试失败的任务');
    }

    // 检查重试次数
    if (task.retryCount >= 3) {
      throw new BadRequestException('重试次数已达上限');
    }

    // 重置任务状态
    const updatedTask = await this.prisma.buildTask.update({
      where: { id },
      data: {
        status: TaskStatus.PENDING,
        retryCount: task.retryCount + 1,
        progress: 0,
        startTime: null,
        endTime: null,
        duration: null,
        errorMessage: null,
      },
      include: {
        miniprogram: {
          select: {
            id: true,
            name: true,
            appId: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });

    // 重新添加到队列
    const jobData: BuildJobData = {
      taskId: id,
      appId: task.appId,
      type: task.type,
      branch: task.branch,
      version: task.version,
      description: task.description,
      operator: task.operator,
    };

    await this.buildQueue.add('build-miniprogram', jobData, {
      priority: task.priority,
      attempts: 1, // 重试任务只尝试一次
      removeOnComplete: 10,
      removeOnFail: 10,
    });

    this.logger.log(`Build task ${id} retried and added to queue`);

    return updatedTask;
  }

  /**
   * 获取构建任务统计信息
   */
  async getStatistics(userId?: string, appId?: string): Promise<Record<string, any>> {
    const where: Prisma.BuildTaskWhereInput = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (appId) {
      where.appId = appId;
    }

    const [total, pending, running, success, failed, cancelled] = await Promise.all([
      this.prisma.buildTask.count({ where }),
      this.prisma.buildTask.count({ where: { ...where, status: TaskStatus.PENDING } }),
      this.prisma.buildTask.count({ where: { ...where, status: TaskStatus.RUNNING } }),
      this.prisma.buildTask.count({ where: { ...where, status: TaskStatus.SUCCESS } }),
      this.prisma.buildTask.count({ where: { ...where, status: TaskStatus.FAILED } }),
      this.prisma.buildTask.count({ where: { ...where, status: TaskStatus.CANCELLED } }),
    ]);

    return {
      total,
      pending,
      running,
      success,
      failed,
      cancelled,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
    };
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(): Promise<Record<string, any>> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.buildQueue.getWaiting(),
      this.buildQueue.getActive(),
      this.buildQueue.getCompleted(),
      this.buildQueue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  /**
   * 清理过期的构建任务
   */
  async cleanupExpiredTasks(): Promise<number> {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 30); // 30天前

    const result = await this.prisma.buildTask.deleteMany({
      where: {
        createTime: {
          lt: expiredDate,
        },
        status: {
          in: [TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.CANCELLED],
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired build tasks`);
    return result.count;
  }
}