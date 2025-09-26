import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BuildType, Miniprogram, MiniprogramConfig } from '@prisma/client';
import { exec } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { promisify } from 'util';
import { GitCredentialsService } from '../../git-credentials/git-credentials.service';
import { BuildGateway } from '../../websocket/gateways/build.gateway';

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

  constructor(
    private readonly configService: ConfigService,
    private readonly gitCredentialsService: GitCredentialsService,
    private readonly buildGateway: BuildGateway,
  ) {}

  /**
   * 执行构建
   */
  async build(options: BuildOptions): Promise<BuildResult> {
    const { taskId, miniprogram, type, branch, version, description, onProgress, onLog } = options;
    const workspaceDir = this.configService.get('build.workspace', '/tmp/build');
    const taskDir = path.join(workspaceDir, taskId);

    // 创建统一的WebSocket通信函数
    const sendLog = async (log: string, level: 'info' | 'warn' | 'error' = 'info') => {
      this.buildGateway.sendBuildLog(taskId, log, level);
      await onLog?.(log);
    };

    const updateStatus = async (status: string, progress?: number, message?: string, result?: any) => {
      this.buildGateway.sendBuildStatus(taskId, status, { progress, message, result });
      if (progress !== undefined && message) {
        await onProgress?.(progress, message);
      }
    };

    try {
      // 发送构建开始状态
      await updateStatus('BUILDING', 0, '开始构建任务');

      // 1. 创建工作目录
      await updateStatus('BUILDING', 10, '创建工作目录');
      await fs.ensureDir(taskDir);
      await sendLog(`工作目录: ${taskDir}`);

      // 2. 克隆代码
      await updateStatus('BUILDING', 20, '克隆代码仓库');
      await this.cloneRepository(miniprogram, branch, taskDir, sendLog);

      // 3. 安装依赖
      await updateStatus('BUILDING', 30, '安装项目依赖');
      await this.installDependencies(taskDir, miniprogram, sendLog);

      // 4. 执行原生小程序npm构建
      await updateStatus('BUILDING', 40, '执行原生小程序npm构建');
      await this.buildNativeMiniprogram(taskDir, miniprogram, sendLog);

      // 5. 执行构建
      await updateStatus('BUILDING', 60, '执行项目构建');
      await this.buildProject(taskDir, miniprogram, sendLog);

      // 6. 上传或预览
      await updateStatus('BUILDING', 80, type === BuildType.UPLOAD ? '上传小程序' : '生成预览');
      const result = await this.uploadOrPreview(taskDir, miniprogram, type, version, description, sendLog, taskId);

      // 7. 清理工作目录
      await updateStatus('BUILDING', 90, '清理临时文件');
      await fs.remove(taskDir);

      // 发送构建成功状态
      await updateStatus('SUCCESS', 100, '构建完成', result);
      await sendLog('构建任务执行成功');

      return result;

    } catch (error) {
      // 发送构建失败状态
      await updateStatus('FAILED', undefined, error.message, { error: error.message });
      await sendLog(`构建失败: ${error.message}`, 'error');

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

    const { gitUrl, gitCredentialId } = config;
    
    let cloneUrl = gitUrl;
    let gitUsername: string | undefined;
    let gitPassword: string | undefined;
    let gitToken: string | undefined;
    
    // 如果配置了Git凭证ID，则查询并解密凭证信息
    if (gitCredentialId) {
      try {
        const credential = await this.gitCredentialsService.getDecryptedCredential(
          gitCredentialId,
          miniprogram.userId,
        );
        
        // 根据认证类型设置相应的凭证信息
        switch (credential.authType) {
          case 'HTTPS':
            gitUsername = credential.username;
            gitPassword = credential.decryptedPassword;
            break;
          case 'TOKEN':
            gitToken = credential.decryptedToken;
            break;
          case 'SSH':
            // SSH认证需要特殊处理，这里暂时跳过
            await onLog?.('SSH认证暂不支持，请使用HTTPS或TOKEN认证');
            throw new Error('SSH认证暂不支持');
          default:
            await onLog?.(`不支持的认证类型: ${credential.authType}`);
            throw new Error(`不支持的认证类型: ${credential.authType}`);
        }
      } catch (error) {
        await onLog?.(`获取Git凭证失败: ${error.message}`);
        throw new Error(`获取Git凭证失败: ${error.message}`);
      }
    }
    
    // 处理认证URL
    if (gitToken) {
      // 使用Token认证，Token需要URL编码
      const encodedToken = encodeURIComponent(gitToken);
      if (gitUrl.includes('github.com')) {
        cloneUrl = gitUrl.replace('https://', `https://${encodedToken}@`);
      } else if (gitUrl.includes('gitlab.com')) {
        cloneUrl = gitUrl.replace('https://', `https://oauth2:${encodedToken}@`);
      } else {
        // 其他Git服务器，尝试通用Token认证格式
        cloneUrl = gitUrl.replace('https://', `https://${encodedToken}@`);
      }
    } else if (gitUsername && gitPassword) {
      // 使用用户名密码认证，用户名和密码都需要URL编码
      const encodedUsername = encodeURIComponent(gitUsername);
      const encodedPassword = encodeURIComponent(gitPassword);
      cloneUrl = gitUrl.replace('https://', `https://${encodedUsername}:${encodedPassword}@`);
    }

    // 检查目标目录是否存在，如果存在则清理
    if (await fs.pathExists(targetDir)) {
      await onLog?.(`目标目录已存在，正在清理: ${targetDir}`);
      try {
        await fs.remove(targetDir);
        await onLog?.(`目录清理完成: ${targetDir}`);
      } catch (cleanError) {
        await onLog?.(`清理目录失败: ${cleanError.message}`);
        throw new Error(`清理目录失败: ${cleanError.message}`);
      }
    }

    // 确保父目录存在
    const parentDir = path.dirname(targetDir);
    await fs.ensureDir(parentDir);

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

  private async buildNativeMiniprogram(
    projectDir: string,
    miniprogram: Miniprogram & { config?: any },
    onLog?: (log: string) => Promise<void>,
  ) {
    const { appId, privateKeyPath, config } = miniprogram;
    const { outputDir } = miniprogram.config || {};
    
    // 确定小程序代码目录
    const miniprogramDir = outputDir ? path.join(projectDir, outputDir) : projectDir;

    // 如果不是原生小程序，跳过构建步骤
    if (config.projectType !== 'NATIVE') {
      await onLog?.('非原生小程序，跳过npm构建步骤');
      return;
    }

    // 如果不是原生小程序，跳过构建步骤
    if (!config.npm) {
      await onLog?.('该小程序不需要构建npm，跳过构建步骤');
      return;
    }

    // 执行原生小程序npm构建
    try {
      const ci = require('miniprogram-ci');
      
      const project = new ci.Project({
        appid: appId,
        type: 'miniProgram',
        projectPath: miniprogramDir,
        privateKeyPath,
        ignores: [
          'node_modules/**/*',
        ],
      });
      
      const warning = await ci.packNpm(project, {
        ignores: ['pack_npm_ignore_list'],
        reporter: async (infos) => { 
          console.log(infos)
          await onLog?.(`npm构建进度: ${JSON.stringify(infos)}`);
        }
      })
      
      await onLog?.(warning.map((it, index) => {
              return `${index + 1}. ${it.msg}\t> code: ${it.code}\t@ ${it.jsPath}:${it.startLine}-${it.endLine}`
            }).join('---------------\n'))
    } catch (error) {
      throw new Error(`原生小程序构建失败: ${error.message}`);
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

    if (projectType === 'NATIVE') {
      await onLog?.('微信小程序，跳过构建步骤');
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
    miniprogram: Miniprogram & { config?: MiniprogramConfig & { outputDir: string} },
    type: BuildType,
    version: string,
    description?: string,
    onLog?: (log: string) => Promise<void>,
    taskId?: string,
  ): Promise<BuildResult> {
    const { appId, privateKeyPath, config } = miniprogram;
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
        ignores: [
          'node_modules/**/*',
        ],
      });

      let result: BuildResult = {};

      if (type === BuildType.UPLOAD) {
        await onLog?.(`开始上传小程序，版本: ${version}`);
        
        const uploadResult = await ci.upload({
          project,
          version,
          desc: description || `自动构建版本 ${version}`,
          setting: {
            es6: config.es6,
            es7: config.es7,
            minifyJS: config.minifyJS,
            minifyWXML: config.minifyWXML,
            minifyWXSS: config.minifyWXSS,
            minify: config.minify,
            codeProtect: config.codeProtect,
            autoPrefixWXSS: config.autoPrefixWXSS,
          },
          onProgressUpdate: async (progress) => {
            console.log('progress',progress);
            await onLog?.(`上传进度: ${JSON.stringify(progress)}`);
          },
        });

        await onLog?.(`上传成功，包大小信息: ${JSON.stringify(uploadResult.subPackageInfo)}`);
        
        result.packageSize = uploadResult.subPackageInfo;
        
      } else if (type === BuildType.PREVIEW) {
        await onLog?.(`开始生成预览二维码`);
        await ci.preview({
          project,
          desc: description || `预览版本 ${version}`,
          setting: {
            es6: config.es6,
            es7: config.es7,
            minifyJS: config.minifyJS,
            minifyWXML: config.minifyWXML,
            minifyWXSS: config.minifyWXSS,
            minify: config.minify,
            codeProtect: config.codeProtect,
            autoPrefixWXSS: config.autoPrefixWXSS,
          },
          qrcodeFormat: config.qrcodeFormat.toLowerCase() || 'base64',
          qrcodeOutputDest: path.join('./uploads/preview/', `${ taskId }.jpg`),
          pagePath: config.pagePath || 'pages/index/index',
          searchQuery: config.searchQuery || undefined,
          scene: config.scene || 1011,
          onProgressUpdate: async (progress) => {
            await onLog?.(`预览生成进度: ${JSON.stringify(progress)}`);
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