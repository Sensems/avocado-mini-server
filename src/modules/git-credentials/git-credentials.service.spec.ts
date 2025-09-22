import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { GitCredentialsService } from './git-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { UpdateGitCredentialDto } from './dto/update-git-credential.dto';
import { GitAuthType, CredentialStatus } from '@prisma/client';

describe('GitCredentialsService', () => {
  let service: GitCredentialsService;
  let prismaService: PrismaService;
  let encryptionService: EncryptionService;

  const mockPrismaService = {
    gitCredential: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encryptSensitiveFields: jest.fn(),
    decryptSensitiveFields: jest.fn(),
    decryptSensitiveData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitCredentialsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<GitCredentialsService>(GitCredentialsService);
    prismaService = module.get<PrismaService>(PrismaService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const userId = 1;
    const createDto: CreateGitCredentialDto = {
      name: 'Test Credential',
      authType: GitAuthType.HTTPS,
      username: 'testuser',
      password: 'testpassword',
      description: 'Test description',
    };

    it('should create a git credential with encrypted sensitive fields', async () => {
      const encryptedData = {
        ...createDto,
        password: 'encrypted_password',
      };

      mockPrismaService.gitCredential.findFirst.mockResolvedValue(null);
      mockEncryptionService.encryptSensitiveFields.mockReturnValue(encryptedData);
      mockPrismaService.gitCredential.create.mockResolvedValue({
        id: 1,
        ...encryptedData,
        userId,
        status: CredentialStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: userId,
          username: 'testuser',
          nickname: 'Test User',
        },
      });

      const result = await service.create(userId, createDto);

      expect(mockEncryptionService.encryptSensitiveFields).toHaveBeenCalledWith(
        createDto,
        ['password', 'token', 'sshKey'],
      );
      expect(mockPrismaService.gitCredential.create).toHaveBeenCalledWith({
        data: {
          ...encryptedData,
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
        },
      });
      // 注意：create方法返回的结果不包含敏感字段，所以不应该检查password
      expect(result.id).toBe(1);
    });

    it('should throw ConflictException if credential name already exists', async () => {
      mockPrismaService.gitCredential.findFirst.mockResolvedValue({
        id: 1,
        name: createDto.name,
        userId,
      });

      await expect(service.create(userId, createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const credentialId = 1;
    const userId = 1;
    const updateDto: UpdateGitCredentialDto = {
      password: 'newpassword',
      token: 'newtoken',
    };

    it('should update a git credential with encrypted sensitive fields', async () => {
      const existingCredential = {
        id: credentialId,
        name: 'Test Credential',
        userId,
        user: {
          id: userId,
          username: 'testuser',
          nickname: 'Test User',
        },
        _count: {
          miniprogramConfigs: 0,
        },
      };

      const encryptedData = {
        ...updateDto,
        password: 'encrypted_new_password',
        token: 'encrypted_new_token',
      };

      mockPrismaService.gitCredential.findFirst.mockResolvedValue(existingCredential);
      mockEncryptionService.encryptSensitiveFields.mockReturnValue(encryptedData);
      mockPrismaService.gitCredential.update.mockResolvedValue({
        id: credentialId,
        name: 'Updated Credential',
        description: 'Updated description',
        authType: GitAuthType.HTTPS,
        username: 'testuser',
        status: CredentialStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId,
        user: {
          id: userId,
          username: 'testuser',
          nickname: 'Test User',
        },
      });

      const result = await service.update(credentialId, userId, updateDto);

      expect(mockEncryptionService.encryptSensitiveFields).toHaveBeenCalledWith(
        updateDto,
        ['password', 'token', 'sshKey'],
      );
      expect(mockPrismaService.gitCredential.update).toHaveBeenCalledWith({
        where: { id: credentialId },
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
      // 注意：update方法现在返回的结果不包含敏感字段
      expect(result.name).toBe('Updated Credential');
      expect(result.description).toBe('Updated description');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('sshKey');
    });

    it('should throw NotFoundException if credential does not exist', async () => {
      mockPrismaService.gitCredential.findFirst.mockResolvedValue(null);

      await expect(service.update(credentialId, userId, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDecryptedCredential', () => {
    const credentialId = 1;
    const userId = 1;

    it('should return decrypted credential', async () => {
      const encryptedCredential = {
        id: credentialId,
        name: 'Test Credential',
        authType: GitAuthType.HTTPS,
        username: 'testuser',
        password: 'encrypted_password',
        token: 'encrypted_token',
        sshKey: 'encrypted_ssh_key',
        userId,
        user: {
          id: userId,
          username: 'testuser',
          nickname: 'Test User',
        },
        _count: {
          miniprogramConfigs: 0,
        },
      };

      mockPrismaService.gitCredential.findFirst.mockResolvedValue(encryptedCredential);
      mockEncryptionService.decryptSensitiveData
        .mockReturnValueOnce('decrypted_password')
        .mockReturnValueOnce('decrypted_token')
        .mockReturnValueOnce('decrypted_ssh_key');

      const result = await service.getDecryptedCredential(credentialId, userId);

      expect(mockEncryptionService.decryptSensitiveData).toHaveBeenCalledWith('encrypted_password');
      expect(mockEncryptionService.decryptSensitiveData).toHaveBeenCalledWith('encrypted_token');
      expect(mockEncryptionService.decryptSensitiveData).toHaveBeenCalledWith('encrypted_ssh_key');
      expect(result.decryptedPassword).toBe('decrypted_password');
      expect(result.decryptedToken).toBe('decrypted_token');
      expect(result.decryptedSshKey).toBe('decrypted_ssh_key');
    });

    it('should throw NotFoundException if credential does not exist', async () => {
      mockPrismaService.gitCredential.findFirst.mockResolvedValue(null);

      await expect(service.getDecryptedCredential(credentialId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateCredential', () => {
    const credentialId = 1;
    const userId = 1;

    it('should return true for valid credential', async () => {
      const encryptedCredential = {
        id: credentialId,
        password: 'encrypted_password',
        userId,
        user: {
          id: userId,
          username: 'testuser',
          nickname: 'Test User',
        },
        _count: {
          miniprogramConfigs: 0,
        },
      };

      mockPrismaService.gitCredential.findFirst.mockResolvedValue(encryptedCredential);
      mockEncryptionService.decryptSensitiveData.mockReturnValue('decrypted_password');

      const result = await service.validateCredential(credentialId, userId);

      expect(result).toEqual({ isValid: true });
    });

    it('should return false for invalid credential (decryption fails)', async () => {
      const encryptedCredential = {
        id: credentialId,
        password: 'invalid_encrypted_password',
        userId,
        user: {
          id: userId,
          username: 'testuser',
          nickname: 'Test User',
        },
        _count: {
          miniprogramConfigs: 0,
        },
      };

      mockPrismaService.gitCredential.findFirst.mockResolvedValue(encryptedCredential);
      mockEncryptionService.decryptSensitiveData.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await service.validateCredential(credentialId, userId);

      expect(result).toEqual({ isValid: false, error: expect.any(String) });
    });

    it('should return false if credential does not exist', async () => {
      mockPrismaService.gitCredential.findFirst.mockResolvedValue(null);

      const result = await service.validateCredential(credentialId, userId);

      expect(result).toEqual({ isValid: false, error: expect.any(String) });
    });
  });
});