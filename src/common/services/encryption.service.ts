import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly saltRounds = 12; // bcrypt 盐轮数
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    // 从环境变量获取加密密钥，如果没有则使用默认值（生产环境必须设置）
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || 'default-encryption-key-change-in-production';
  }

  /**
   * 使用 bcrypt 对密码进行哈希处理（不可逆）
   * 适用于用户密码等不需要解密的敏感信息
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * 验证密码是否匹配哈希值
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * 使用 AES 加密敏感数据（可逆）
   * 适用于需要解密使用的敏感信息，如 API 密钥、访问令牌等
   */
  encryptSensitiveData(data: string): string {
    if (!data) return data;
    
    try {
      const encrypted = CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      throw new Error('加密失败');
    }
  }

  /**
   * 解密敏感数据
   */
  decryptSensitiveData(encryptedData: string): string {
    if (!encryptedData) return encryptedData;
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const originalData = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!originalData) {
        throw new Error('解密失败：无效的加密数据');
      }
      
      return originalData;
    } catch (error) {
      throw new Error('解密失败');
    }
  }

  /**
   * 批量加密敏感字段
   */
  encryptSensitiveFields(data: Record<string, any>, sensitiveFields: string[]): Record<string, any> {
    const result = { ...data };
    
    sensitiveFields.forEach(field => {
      if (result[field]) {
        result[field] = this.encryptSensitiveData(result[field]);
      }
    });
    
    return result;
  }

  /**
   * 批量解密敏感字段
   */
  decryptSensitiveFields(data: Record<string, any>, sensitiveFields: string[]): Record<string, any> {
    const result = { ...data };
    
    sensitiveFields.forEach(field => {
      if (result[field]) {
        try {
          result[field] = this.decryptSensitiveData(result[field]);
        } catch (error) {
          // 如果解密失败，保持原值（可能是未加密的历史数据）
          console.warn(`解密字段 ${field} 失败:`, error.message);
        }
      }
    });
    
    return result;
  }

  /**
   * 检查数据是否已加密（简单检查，基于 AES 加密后的特征）
   */
  isEncrypted(data: string): boolean {
    if (!data) return false;
    
    try {
      // AES 加密后的数据通常是 Base64 格式，长度较长且包含特定字符
      const base64Regex = /^[A-Za-z0-9+/]+=*$/;
      return base64Regex.test(data) && data.length > 20;
    } catch {
      return false;
    }
  }
}