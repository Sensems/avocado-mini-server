import { Test, TestingModule } from '@nestjs/testing';
import { GitOperationService } from './git-operation.service';
import { GitCredentialsService } from '../../modules/git-credentials/git-credentials.service';
import { EncryptionService } from './encryption.service';
import { 
  GetRepositoryBranchesDto, 
  GitOperationException, 
  GitOperationErrorType 
} from '../dto/git-operation.dto';
import { GitAuthType } from '@prisma/client';

describe('GitOperationService', () => {
  let service: GitOperationService;
  let gitCredentialsService: GitCredentialsService;
  let encryptionService: EncryptionService;

  const mockGitCredentialsService = {
    getDecryptedCredential: jest.fn(),
    validateCredential: jest.fn(),
  };

  const mockEncryptionService = {
    decryptSensitiveData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitOperationService,
        {
          provide: GitCredentialsService,
          useValue: mockGitCredentialsService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<GitOperationService>(GitOperationService);
    gitCredentialsService = module.get<GitCredentialsService>(GitCredentialsService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRepositoryBranches', () => {
    const userId = 1;
    const dto: GetRepositoryBranchesDto = {
      repositoryUrl: 'https://github.com/test/repo.git',
      credentialId: 1,
    };

    const mockCredential = {
      id: 1,
      authType: GitAuthType.HTTPS,
      username: 'testuser',
      decryptedPassword: 'testpassword',
      decryptedToken: null,
      decryptedSshKey: null,
    };

    it('should validate repository URL format', async () => {
      const invalidDto = {
        ...dto,
        repositoryUrl: 'invalid-url',
      };

      const result = await service.getRepositoryBranches(userId, invalidDto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('无效的Git仓库URL格式');
    });

    it('should handle invalid credentials', async () => {
      mockGitCredentialsService.getDecryptedCredential.mockResolvedValue(mockCredential);
      mockGitCredentialsService.validateCredential.mockResolvedValue({
        isValid: false,
        error: '凭证验证失败',
      });

      const result = await service.getRepositoryBranches(userId, dto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('凭证验证失败');
    });

    it('should handle HTTPS authentication', async () => {
      mockGitCredentialsService.getDecryptedCredential.mockResolvedValue(mockCredential);
      mockGitCredentialsService.validateCredential.mockResolvedValue({
        isValid: true,
      });

      // Mock Git operations would require more complex setup
      // This test focuses on the credential validation flow
      const result = await service.getRepositoryBranches(userId, dto);

      expect(mockGitCredentialsService.getDecryptedCredential).toHaveBeenCalledWith(
        dto.credentialId,
        userId,
      );
      expect(mockGitCredentialsService.validateCredential).toHaveBeenCalledWith(
        dto.credentialId,
        userId,
      );
    });

    it('should handle SSH authentication', async () => {
      const sshCredential = {
        ...mockCredential,
        authType: GitAuthType.SSH,
        username: null,
        decryptedPassword: null,
        decryptedSshKey: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key\n-----END OPENSSH PRIVATE KEY-----',
      };

      mockGitCredentialsService.getDecryptedCredential.mockResolvedValue(sshCredential);
      mockGitCredentialsService.validateCredential.mockResolvedValue({
        isValid: true,
      });

      const result = await service.getRepositoryBranches(userId, dto);

      expect(mockGitCredentialsService.getDecryptedCredential).toHaveBeenCalledWith(
        dto.credentialId,
        userId,
      );
    });

    it('should handle TOKEN authentication', async () => {
      const tokenCredential = {
        ...mockCredential,
        authType: GitAuthType.TOKEN,
        username: null,
        decryptedPassword: null,
        decryptedToken: 'ghp_test_token_123456789',
      };

      mockGitCredentialsService.getDecryptedCredential.mockResolvedValue(tokenCredential);
      mockGitCredentialsService.validateCredential.mockResolvedValue({
        isValid: true,
      });

      const result = await service.getRepositoryBranches(userId, dto);

      expect(mockGitCredentialsService.getDecryptedCredential).toHaveBeenCalledWith(
        dto.credentialId,
        userId,
      );
    });

    it('should handle missing credentials for HTTPS auth', async () => {
      const incompleteCredential = {
        ...mockCredential,
        username: null,
        decryptedPassword: null,
      };

      mockGitCredentialsService.getDecryptedCredential.mockResolvedValue(incompleteCredential);
      mockGitCredentialsService.validateCredential.mockResolvedValue({
        isValid: true,
      });

      const result = await service.getRepositoryBranches(userId, dto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTPS认证需要用户名和密码');
    });

    it('should handle missing SSH key', async () => {
      const incompleteCredential = {
        ...mockCredential,
        authType: GitAuthType.SSH,
        decryptedSshKey: null,
      };

      mockGitCredentialsService.getDecryptedCredential.mockResolvedValue(incompleteCredential);
      mockGitCredentialsService.validateCredential.mockResolvedValue({
        isValid: true,
      });

      const result = await service.getRepositoryBranches(userId, dto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SSH认证需要私钥');
    });

    it('should handle missing token', async () => {
      const incompleteCredential = {
        ...mockCredential,
        authType: GitAuthType.TOKEN,
        decryptedToken: null,
      };

      mockGitCredentialsService.getDecryptedCredential.mockResolvedValue(incompleteCredential);
      mockGitCredentialsService.validateCredential.mockResolvedValue({
        isValid: true,
      });

      const result = await service.getRepositoryBranches(userId, dto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token认证需要访问令牌');
    });

    it('should handle service errors gracefully', async () => {
      mockGitCredentialsService.getDecryptedCredential.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await service.getRepositoryBranches(userId, dto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('未知错误');
    });
  });

  describe('GitOperationException', () => {
    it('should create exception with correct properties', () => {
      const originalError = new Error('Original error');
      const exception = new GitOperationException(
        GitOperationErrorType.AUTHENTICATION_FAILED,
        'Authentication failed',
        originalError,
      );

      expect(exception.type).toBe(GitOperationErrorType.AUTHENTICATION_FAILED);
      expect(exception.message).toBe('Authentication failed');
      expect(exception.originalError).toBe(originalError);
      expect(exception.name).toBe('GitOperationException');
    });
  });
});