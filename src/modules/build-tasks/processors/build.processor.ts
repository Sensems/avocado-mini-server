import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TaskStatus } from '@prisma/client';
import { BuildTasksService, BuildJobData } from '../build-tasks.service';
import { MiniprogramsService } from '../../miniprograms/miniprograms.service';
import { BuildService } from '../services/build.service';

@Processor('build')
export class BuildProcessor {
  private readonly logger = new Logger(BuildProcessor.name);

  constructor(
    private readonly buildTasksService: BuildTasksService,
    private readonly miniprogramsService: MiniprogramsService,
    private readonly buildService: BuildService,
  ) {}

  @Process('build-miniprogram')
  async handleBuildMiniprogram(job: Job<BuildJobData>): Promise<void> {
    const { taskId, appId, type, branch, version, description, operator } = job.data;

    this.logger.log(`Starting build task ${taskId} for app ${appId}`);

    try {
      // 更新任务状态为运行中
      await this.buildTasksService.updateStatus(taskId, TaskStatus.RUNNING);
      await this.buildTasksService.appendLog(taskId, `[${new Date().toISOString()}] 开始构建任务`);

      // 获取小程序配置
      const miniprogram = await this.miniprogramsService.findOne(appId);
      if (!miniprogram) {
        throw new Error('小程序不存在');
      }

      await this.buildTasksService.appendLog(
        taskId,
        `[${new Date().toISOString()}] 小程序: ${miniprogram.name} (${miniprogram.appId})`,
      );

      // 更新进度
      await this.buildTasksService.updateProgress(taskId, 10);

      // 执行构建
      const buildResult = await this.buildService.build({
        taskId,
        miniprogram,
        type,
        branch,
        version,
        description,
        operator,
        onProgress: async (progress: number, message?: string) => {
          await this.buildTasksService.updateProgress(taskId, progress);
          if (message) {
            await this.buildTasksService.appendLog(taskId, `[${new Date().toISOString()}] ${message}`);
          }
        },
        onLog: async (log: string) => {
          await this.buildTasksService.appendLog(taskId, `[${new Date().toISOString()}] ${log}`);
        },
      });

      // 更新任务状态为成功
      await this.buildTasksService.updateStatus(taskId, TaskStatus.SUCCESS, {
        qrcodeUrl: buildResult.qrcodeUrl,
        packageSize: buildResult.packageSize,
      });

      await this.buildTasksService.appendLog(
        taskId,
        `[${new Date().toISOString()}] 构建任务完成`,
      );

      this.logger.log(`Build task ${taskId} completed successfully`);

    } catch (error) {
      this.logger.error(`Build task ${taskId} failed:`, error);

      // 更新任务状态为失败
      await this.buildTasksService.updateStatus(taskId, TaskStatus.FAILED, {
        errorMessage: error.message,
      });

      await this.buildTasksService.appendLog(
        taskId,
        `[${new Date().toISOString()}] 构建失败: ${error.message}`,
      );

      throw error;
    }
  }
}