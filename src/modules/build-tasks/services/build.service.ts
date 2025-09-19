import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Miniprogram, BuildType } from '@prisma/client';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BuildOptions {
  taskId: string;
  miniprogram: Miniprogram & { config?: any };
  type: BuildType;
  branch: string;
  version: string;
  description?: string;
  operator: string;
  onProgress?: (progress: number, message?: string) => Promise<void>;
  onLog?: (log: string) => Promise<void>;
}

export interface BuildResult {
  qrcodeUrl?: string;
  packageSize?: Record<string, any>;
}

@Injectable()
export class BuildService {
  private readonly logger = new Logger(BuildService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 执行构建
   */
  async build(options: BuildOptions): Promise<BuildResult> {
    const { taskId, miniprogram, type, branch, version, description, onProgress, onLog } = options;
    
    const workspaceDir = this.configService.get('build.workspace', '/tmp/build');
    const taskDir = path.join(workspaceDir, taskId);

    try {
      // 1. 创建工作目录
      await onProgress?.(10, '创建工作目录');
      await fs.ensureDir(taskDir);
      await onLog?.(`工作目录: ${taskDir}`);

      // 2. 克隆代码
      await onProgress?.(20, '克隆代码仓库');
      await this.cloneRepository(miniprogram, branch, taskDir, onLog);

      // 3. 安装依赖
      await onProgress?.(40, '安装项目依赖');
      await this.installDependencies(taskDir, miniprogram, onLog);

      // 4. 执行构建
      await onProgress?.(60, '执行项目构建');
      await this.buildProject(taskDir, miniprogram, onLog);

      // 5. 上传或预览
      await onProgress?.(80, type === BuildType.UPLOAD ? '上传小程序' : '生成预览');
      const result = await this.uploadOrPreview(taskDir, miniprogram, type, version, description, onLog);

      // 6. 清理工作目录
      await onProgress?.(100, '清理临时文件');
      await fs.remove(taskDir);

      return result;

    } catch (error) {
      // 清理工作目录
      try {
        await fs.remove(taskDir);
      } catch (cleanupError) {
        this.logger.error('Failed to cleanup workspace:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * 克隆代码仓库
   */
  private async cloneRepository(
    miniprogram: Miniprogram & { config?: any },
    branch: string,
    targetDir: string,
    onLog?: (log: string) => Promise<void>,
  ): Promise<void> {
    const { config } = miniprogram;
    
    if (!config?.gitUrl) {
      throw new Error('未配置Git仓库地址');
    }

    const { gitUrl, gitUsername, gitPassword, gitToken } = config;
    
    let cloneUrl = gitUrl;
    
    // 处理认证
    if (gitToken) {
      // 使用Token认证
      if (gitUrl.includes('github.com')) {
        cloneUrl = gitUrl.replace('https://', `https://${gitToken}@`);
      } else if (gitUrl.includes('gitlab.com')) {
        cloneUrl = gitUrl.replace('https://', `https://oauth2:${gitToken}@`);
      }
    } else if (gitUsername && gitPassword) {
      // 使用用户名密码认证
      cloneUrl = gitUrl.replace('https://', `https://${gitUsername}:${gitPassword}@`);
    }

    const cloneCmd = `git clone --depth 1 --branch ${branch} "${cloneUrl}" "${targetDir}"`;
    
    try {
      const { stdout, stderr } = await execAsync(cloneCmd, { timeout: 300000 }); // 5分钟超时
      await onLog?.(`Git clone output: ${stdout}`);
      if (stderr) {
        await onLog?.(`Git clone stderr: ${stderr}`);
      }
    } catch (error) {
      throw new Error(`代码克隆失败: ${error.message}`);
    }
  }

  /**
   * 安装依赖
   */
  private async installDependencies(
    projectDir: string,
    miniprogram: Miniprogram & { config?: any },
    onLog?: (log: string) => Promise<void>,
  ): Promise<void> {
    const packageJsonPath = path.join(projectDir, 'package.json');
    
    // 检查是否存在package.json
    if (!await fs.pathExists(packageJsonPath)) {
      await onLog?.('未找到package.json，跳过依赖安装');
      return;
    }

    // 检测包管理器
    let installCmd = 'npm install';
    
    if (await fs.pathExists(path.join(projectDir, 'yarn.lock'))) {
      installCmd = 'yarn install';
    } else if (await fs.pathExists(path.join(projectDir, 'pnpm-lock.yaml'))) {
      installCmd = 'pnpm install';
    }

    try {
      const { stdout, stderr } = await execAsync(installCmd, {
        cwd: projectDir,
        timeout: 600000, // 10分钟超时
      });
      
      await onLog?.(`依赖安装输出: ${stdout}`);
      if (stderr) {
        await onLog?.(`依赖安装警告: ${stderr}`);
      }
    } catch (error) {
      throw new Error(`依赖安装失败: ${error.message}`);
    }
  }

  /**
   * 构建项目
   */
  private async buildProject(
    projectDir: string,
    miniprogram: Miniprogram & { config?: any },
    onLog?: (log: string) => Promise<void>,
  ): Promise<void> {
    const { buildCommand, projectType } = miniprogram.config || {};

    // 如果没有构建命令，跳过构建步骤
    if (!buildCommand) {
      await onLog?.('未配置构建命令，跳过构建步骤');
      return;
    }

    try {
      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: projectDir,
        timeout: 1800000, // 30分钟超时
      });
      
      await onLog?.(`构建输出: ${stdout}`);
      if (stderr) {
        await onLog?.(`构建警告: ${stderr}`);
      }
    } catch (error) {
      throw new Error(`项目构建失败: ${error.message}`);
    }
  }

  /**
   * 上传或预览小程序
   */
  private async uploadOrPreview(
    projectDir: string,
    miniprogram: Miniprogram & { config?: any },
    type: BuildType,
    version: string,
    description?: string,
    onLog?: (log: string) => Promise<void>,
  ): Promise<BuildResult> {
    const { appId, privateKeyPath } = miniprogram;
    const { outputDir } = miniprogram.config || {};
    
    // 确定小程序代码目录
    const miniprogramDir = outputDir ? path.join(projectDir, outputDir) : projectDir;
    
    // 检查小程序代码目录是否存在
    if (!await fs.pathExists(miniprogramDir)) {
      throw new Error(`小程序代码目录不存在: ${miniprogramDir}`);
    }

    // 检查私钥文件是否存在
    if (!privateKeyPath || !await fs.pathExists(privateKeyPath)) {
      throw new Error('私钥文件不存在，请先上传私钥文件');
    }

    try {
      // 使用miniprogram-ci进行上传或预览
      const ci = require('miniprogram-ci');
      
      const project = new ci.Project({
        appid: appId,
        type: 'miniProgram',
        projectPath: miniprogramDir,
        privateKeyPath,
        ignores: ['node_modules/**/*'],
      });

      let result: BuildResult = {};

      if (type === BuildType.UPLOAD) {
        await onLog?.(`开始上传小程序，版本: ${version}`);
        
        const uploadResult = await ci.upload({
          project,
          version,
          desc: description || `自动构建版本 ${version}`,
          setting: {
            es6: true,
            es7: true,
            minify: true,
            codeProtect: false,
            autoPrefixWXSS: true,
          },
          onProgressUpdate: (progress) => {
            onLog?.(`上传进度: ${progress}%`);
          },
        });

        await onLog?.(`上传成功，包大小信息: ${JSON.stringify(uploadResult.subPackageInfo)}`);
        
        result.packageSize = uploadResult.subPackageInfo;
        
      } else if (type === BuildType.PREVIEW) {
        await onLog?.(`开始生成预览二维码`);
        
        const previewResult = await ci.preview({
          project,
          desc: description || `预览版本 ${version}`,
          setting: {
            es6: true,
            es7: true,
            minify: false,
            codeProtect: false,
            autoPrefixWXSS: true,
          },
          qrcodeFormat: 'image',
          qrcodeOutputDest: path.join(projectDir, 'preview.jpg'),
          onProgressUpdate: (progress) => {
            onLog?.(`预览生成进度: ${progress}%`);
          },
        });

        // TODO: 上传二维码到对象存储，返回URL
        // 这里暂时返回本地路径
        result.qrcodeUrl = path.join(projectDir, 'preview.jpg');
        
        await onLog?.(`预览二维码生成成功`);
      }

      return result;

    } catch (error) {
      throw error;
    }
  }
}