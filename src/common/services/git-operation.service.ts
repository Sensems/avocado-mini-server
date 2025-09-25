import { Injectable, Logger } from '@nestjs/common';
import { GitAuthType } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SimpleGit, simpleGit as createGit } from 'simple-git';
import { GitCredentialsService } from '../../modules/git-credentials/git-credentials.service';
import {
  GetRepositoryBranchesDto,
  GetRepositoryBranchesResponseDto,
  GitOperationErrorType,
  GitOperationException,
  RepositoryBranch
} from '../dto/git-operation.dto';
import { EncryptionService } from './encryption.service';

@Injectable()
export class GitOperationService {
  private readonly logger = new Logger(GitOperationService.name);
  private readonly tempDir = path.join(os.tmpdir(), 'avocado-git-operations');

  constructor(
    private readonly gitCredentialsService: GitCredentialsService,
    private readonly encryptionService: EncryptionService,
  ) {
    // 确保临时目录存在
    this.ensureTempDirectory();
  }

  /**
   * 获取仓库分支列表
   */
  async getRepositoryBranches(
    userId: number,
    dto: GetRepositoryBranchesDto,
  ): Promise<GetRepositoryBranchesResponseDto> {
    try {
      this.logger.log(`获取仓库分支: ${dto.repositoryUrl}, 用户ID: ${userId}, 凭证ID: ${dto.credentialId}`);

      // 验证仓库URL格式
      this.validateRepositoryUrl(dto.repositoryUrl);

      // 获取并解密凭证
      const credential = await this.gitCredentialsService.getDecryptedCredential(
        dto.credentialId,
        userId,
      );

      // 验证凭证
      const validationResult = await this.gitCredentialsService.validateCredential(
        dto.credentialId,
        userId,
      );

      if (!validationResult.isValid) {
        throw new GitOperationException(
          GitOperationErrorType.INVALID_CREDENTIALS,
          `凭证验证失败: ${validationResult.error}`,
        );
      }

      // 创建临时工作目录
      const workDir = await this.createTempWorkDirectory();

      try {
        // 根据认证类型配置Git操作
        const git = await this.configureGitWithCredentials(workDir, credential, dto.repositoryUrl);

        // 获取远程分支信息
        const branches = await this.fetchRemoteBranches(git, dto.repositoryUrl);

        // 获取默认分支
        const defaultBranch = await this.getDefaultBranch(git, dto.repositoryUrl);

        this.logger.log(`成功获取 ${branches.length} 个分支，默认分支: ${defaultBranch}`);

        return {
          success: true,
          branches,
          defaultBranch,
        };
      } finally {
        // 清理临时目录
        await this.cleanupTempDirectory(workDir);
      }
    } catch (error) {
      this.logger.error(`获取仓库分支失败: ${error.message}`, error.stack);

      if (error instanceof GitOperationException) {
        return {
          success: false,
          branches: [],
          defaultBranch: '',
          error: error.message,
        };
      }

      return {
        success: false,
        branches: [],
        defaultBranch: '',
        error: `未知错误: ${error.message}`,
      };
    }
  }

  /**
   * 验证仓库URL格式
   */
  private validateRepositoryUrl(url: string): void {
    const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/)/;
    if (!gitUrlPattern.test(url)) {
      throw new GitOperationException(
        GitOperationErrorType.INVALID_URL,
        '无效的Git仓库URL格式',
      );
    }
  }

  /**
   * 根据凭证类型配置Git操作
   */
  private async configureGitWithCredentials(
    workDir: string,
    credential: any,
    repositoryUrl: string,
  ): Promise<SimpleGit> {
    const git = createGit(workDir);

    try {
      switch (credential.authType) {
        case GitAuthType.HTTPS:
          return await this.configureHttpsAuth(git, credential, repositoryUrl);
        
        case GitAuthType.SSH:
          return await this.configureSshAuth(git, credential);
        
        case GitAuthType.TOKEN:
          return await this.configureTokenAuth(git, credential, repositoryUrl);
        
        default:
          throw new GitOperationException(
            GitOperationErrorType.INVALID_CREDENTIALS,
            `不支持的认证类型: ${credential.authType}`,
          );
      }
    } catch (error) {
      throw new GitOperationException(
        GitOperationErrorType.AUTHENTICATION_FAILED,
        `Git认证配置失败: ${error.message}`,
        error,
      );
    }
  }

  /**
   * 配置HTTPS认证
   */
  private async configureHttpsAuth(
    git: SimpleGit,
    credential: any,
    repositoryUrl: string,
  ): Promise<SimpleGit> {
    if (!credential.decryptedPassword || !credential.username) {
      throw new GitOperationException(
        GitOperationErrorType.INVALID_CREDENTIALS,
        'HTTPS认证需要用户名和密码',
      );
    }

    // 构建包含认证信息的URL
    const url = new URL(repositoryUrl);
    url.username = encodeURIComponent(credential.username);
    url.password = encodeURIComponent(credential.decryptedPassword);

    // 初始化Git仓库（如果需要）
    try {
      await git.init();
    } catch (error) {
      // 如果已经是Git仓库，忽略错误
      this.logger.debug('Git仓库已存在或初始化失败，继续执行');
    }

    // 配置Git凭证助手，使用全局配置避免本地仓库限制
    try {
      await git.addConfig('credential.helper', '', false, 'global');
      await git.addConfig('credential.helper', 'cache --timeout=300', false, 'global');
    } catch (error) {
      this.logger.warn(`配置Git凭证助手失败: ${error.message}`);
    }
    
    // 将认证后的URL存储到git实例中，供后续操作使用
    const authenticatedUrl = url.toString();
    (git as any)._authenticatedUrl = authenticatedUrl;

    return git;
  }

  /**
   * 配置SSH认证
   */
  private async configureSshAuth(git: SimpleGit, credential: any): Promise<SimpleGit> {
    if (!credential.decryptedSshKey) {
      throw new GitOperationException(
        GitOperationErrorType.INVALID_CREDENTIALS,
        'SSH认证需要私钥',
      );
    }

    // 创建临时SSH密钥文件
    const sshKeyPath = path.join(this.tempDir, `ssh_key_${Date.now()}`);
    await fs.promises.writeFile(sshKeyPath, credential.decryptedSshKey, { mode: 0o600 });

    // 配置Git使用SSH密钥
    await git.env({
      ...process.env,
      GIT_SSH_COMMAND: `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`,
    });

    return git;
  }

  /**
   * 配置Token认证
   */
  private async configureTokenAuth(
    git: SimpleGit,
    credential: any,
    repositoryUrl: string,
  ): Promise<SimpleGit> {
    if (!credential.decryptedToken) {
      throw new GitOperationException(
        GitOperationErrorType.INVALID_CREDENTIALS,
        'Token认证需要访问令牌',
      );
    }

    // 构建包含Token的URL
    const url = new URL(repositoryUrl);
    url.username = credential.decryptedToken;
    url.password = 'x-oauth-basic';

    return git;
  }

  /**
   * 获取远程分支信息
   */
  private async fetchRemoteBranches(git: SimpleGit, repositoryUrl: string): Promise<RepositoryBranch[]> {
    try {
      // 如果是HTTPS认证，使用包含认证信息的URL
      const urlToUse = (git as any)._authenticatedUrl || repositoryUrl;
      
      // 添加远程仓库
      await git.addRemote('origin', urlToUse);

      // 获取远程分支信息
      const remoteRefs = await git.listRemote(['--heads', 'origin']);
      
      if (!remoteRefs) {
        throw new GitOperationException(
          GitOperationErrorType.REPOSITORY_NOT_FOUND,
          '无法获取远程分支信息，请检查仓库URL和访问权限',
        );
      }

      const branches: RepositoryBranch[] = [];
      const lines = remoteRefs.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const [sha, ref] = line.split('\t');
        if (ref && ref.startsWith('refs/heads/')) {
          const branchName = ref.replace('refs/heads/', '');
          
          // 获取分支详细信息
          const branchInfo = await this.getBranchInfo(branchName, sha);
          branches.push(branchInfo);
        }
      }

      return branches;
    } catch (error) {
      if (error instanceof GitOperationException) {
        throw error;
      }

      this.logger.error(`获取远程分支失败: ${error.message}`);
      
      if (error.message.includes('Authentication failed')) {
        throw new GitOperationException(
          GitOperationErrorType.AUTHENTICATION_FAILED,
          '认证失败，请检查凭证信息',
          error,
        );
      }

      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        throw new GitOperationException(
          GitOperationErrorType.REPOSITORY_NOT_FOUND,
          '仓库不存在或无访问权限',
          error,
        );
      }

      throw new GitOperationException(
        GitOperationErrorType.NETWORK_ERROR,
        `网络错误: ${error.message}`,
        error,
      );
    }
  }

  /**
   * 获取分支详细信息
   */
  private async getBranchInfo(
    branchName: string,
    sha: string,
  ): Promise<RepositoryBranch> {
    try {
      // 直接使用已知的 SHA 和分支名称构建分支信息
      // 由于我们只是获取远程分支列表，不需要详细的提交信息
      // 避免使用可能导致 "bad object" 错误的 git 命令
      
      return {
        name: branchName,
        lastCommitSha: sha,
        lastCommitDate: new Date(), // 使用当前时间作为占位符
      };
    } catch (error) {
      this.logger.warn(`获取分支 ${branchName} 详细信息失败: ${error.message}`);
      
      return {
        name: branchName,
        lastCommitSha: sha,
        lastCommitDate: new Date(),
      };
    }
  }

  /**
   * 获取默认分支
   */
  private async getDefaultBranch(git: SimpleGit, repositoryUrl: string): Promise<string> {
    try {
      const result = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      const defaultBranch = result.trim().replace('refs/remotes/origin/', '');
      return defaultBranch || 'main';
    } catch (error) {
      this.logger.warn(`获取默认分支失败: ${error.message}`);
      return 'main'; // 默认返回main分支
    }
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 创建临时工作目录
   */
  private async createTempWorkDirectory(): Promise<string> {
    const workDir = path.join(this.tempDir, `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    await fs.promises.mkdir(workDir, { recursive: true });
    return workDir;
  }

  /**
   * 清理临时目录
   */
  private async cleanupTempDirectory(workDir: string): Promise<void> {
    try {
      if (fs.existsSync(workDir)) {
        await fs.promises.rm(workDir, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.warn(`清理临时目录失败: ${error.message}`);
    }
  }
}