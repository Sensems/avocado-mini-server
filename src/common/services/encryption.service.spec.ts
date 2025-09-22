import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import * as bcrypt from 'bcrypt';
import * as CryptoJS from 'crypto-js';

// Mock bcrypt and crypto-js
jest.mock('bcrypt');
jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
  enc: {
    Utf8: 'utf8',
  },
}));

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
  const mockCryptoJS = CryptoJS as jest.Mocked<typeof CryptoJS>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-encryption-key'),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'testpassword';
      const hashedPassword = '$2b$12$hashedpassword';

      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await service.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password using bcrypt', async () => {
      const password = 'testpassword';
      const hashedPassword = '$2b$12$hashedpassword';

      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.verifyPassword(password, hashedPassword);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const password = 'wrongpassword';
      const hashedPassword = '$2b$12$hashedpassword';

      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.verifyPassword(password, hashedPassword);

      expect(result).toBe(false);
    });
  });

  describe('encryptSensitiveData', () => {
    it('should encrypt text using AES', () => {
      const text = 'sensitive data';
      const encryptedText = 'encrypted_data';

      (mockCryptoJS.AES.encrypt as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(encryptedText),
      });

      const result = service.encryptSensitiveData(text);

      expect(mockCryptoJS.AES.encrypt).toHaveBeenCalledWith(text, 'test-encryption-key');
      expect(result).toBe(encryptedText);
    });

    it('should return original value for empty input', () => {
      const result = service.encryptSensitiveData('');
      expect(result).toBe('');
    });

    it('should return original value for null input', () => {
      const result = service.encryptSensitiveData(null);
      expect(result).toBe(null);
    });

    it('should return original value for undefined input', () => {
      const result = service.encryptSensitiveData(undefined);
      expect(result).toBe(undefined);
    });
  });

  describe('decryptSensitiveData', () => {
    it('should decrypt text using AES', () => {
      const encryptedText = 'encrypted_data';
      const decryptedText = 'sensitive data';

      (mockCryptoJS.AES.decrypt as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(decryptedText),
      });

      const result = service.decryptSensitiveData(encryptedText);

      expect(mockCryptoJS.AES.decrypt).toHaveBeenCalledWith(encryptedText, 'test-encryption-key');
      expect(result).toBe(decryptedText);
    });

    it('should return original value for empty input', () => {
      const result = service.decryptSensitiveData('');
      expect(result).toBe('');
    });

    it('should return original value for null input', () => {
      const result = service.decryptSensitiveData(null);
      expect(result).toBe(null);
    });

    it('should return original value for undefined input', () => {
      const result = service.decryptSensitiveData(undefined);
      expect(result).toBe(undefined);
    });

    it('should handle decryption errors gracefully', () => {
      const encryptedText = 'invalid_encrypted_data';

      (mockCryptoJS.AES.decrypt as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      expect(() => service.decryptSensitiveData(encryptedText)).toThrow('解密失败');
    });
  });

  describe('encryptSensitiveFields', () => {
    it('should encrypt specified sensitive fields', () => {
      const data = {
        name: 'Test Credential',
        password: 'secret_password',
        token: 'secret_token',
        sshKey: 'secret_ssh_key',
        description: 'Test description',
      };

      const sensitiveFields = ['password', 'token', 'sshKey'];

      // Mock encryptSensitiveData method
      const encryptSpy = jest.spyOn(service, 'encryptSensitiveData');
      encryptSpy.mockImplementation((text) => `encrypted_${text}`);

      const result = service.encryptSensitiveFields(data, sensitiveFields);

      expect(result).toEqual({
        name: 'Test Credential',
        password: 'encrypted_secret_password',
        token: 'encrypted_secret_token',
        sshKey: 'encrypted_secret_ssh_key',
        description: 'Test description',
      });

      expect(encryptSpy).toHaveBeenCalledTimes(3);
      expect(encryptSpy).toHaveBeenCalledWith('secret_password');
      expect(encryptSpy).toHaveBeenCalledWith('secret_token');
      expect(encryptSpy).toHaveBeenCalledWith('secret_ssh_key');

      encryptSpy.mockRestore();
    });

    it('should skip encryption for empty or null values', () => {
      const data = {
        password: '',
        token: null,
        sshKey: undefined,
        username: 'testuser',
      };

      const sensitiveFields = ['password', 'token', 'sshKey'];

      const encryptSpy = jest.spyOn(service, 'encryptSensitiveData');

      const result = service.encryptSensitiveFields(data, sensitiveFields);

      expect(result).toEqual({
        password: '',
        token: null,
        sshKey: undefined,
        username: 'testuser',
      });

      expect(encryptSpy).not.toHaveBeenCalled();

      encryptSpy.mockRestore();
    });
  });

  describe('decryptSensitiveFields', () => {
    it('should decrypt specified sensitive fields', () => {
      const data = {
        name: 'Test Credential',
        password: 'encrypted_secret_password',
        token: 'encrypted_secret_token',
        sshKey: 'encrypted_secret_ssh_key',
        description: 'Test description',
      };

      const sensitiveFields = ['password', 'token', 'sshKey'];

      // Mock decryptSensitiveData method
      const decryptSpy = jest.spyOn(service, 'decryptSensitiveData');
      decryptSpy.mockImplementation((text) => text.replace('encrypted_', ''));

      const result = service.decryptSensitiveFields(data, sensitiveFields);

      expect(result).toEqual({
        name: 'Test Credential',
        password: 'secret_password',
        token: 'secret_token',
        sshKey: 'secret_ssh_key',
        description: 'Test description',
      });

      expect(decryptSpy).toHaveBeenCalledTimes(3);
      expect(decryptSpy).toHaveBeenCalledWith('encrypted_secret_password');
      expect(decryptSpy).toHaveBeenCalledWith('encrypted_secret_token');
      expect(decryptSpy).toHaveBeenCalledWith('encrypted_secret_ssh_key');

      decryptSpy.mockRestore();
    });

    it('should skip decryption for empty or null values', () => {
      const data = {
        password: '',
        token: null,
        sshKey: undefined,
        username: 'testuser',
      };

      const sensitiveFields = ['password', 'token', 'sshKey'];

      const decryptSpy = jest.spyOn(service, 'decryptSensitiveData');

      const result = service.decryptSensitiveFields(data, sensitiveFields);

      expect(result).toEqual({
        password: '',
        token: null,
        sshKey: undefined,
        username: 'testuser',
      });

      expect(decryptSpy).not.toHaveBeenCalled();

      decryptSpy.mockRestore();
    });
  });
});