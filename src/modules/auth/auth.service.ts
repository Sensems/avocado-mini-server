import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';

// 定义不包含密码的用户类型
export type UserWithoutPassword = Omit<User, 'password'>;

export interface JwtPayload {
  sub: number;
  username: string;
  email: string;
  role: string;
  permissions: Record<string, any>;
}

export interface LoginResult {
  user: Omit<User, 'password'>;
  accessToken: string;
  tokenType: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 验证用户凭据
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    try {
      const user = await this.usersService.findByUsername(username);
      
      if (!user) {
        this.logger.warn(`Login attempt with non-existent username: ${username}`);
        return null;
      }

      if (user.status !== UserStatus.ACTIVE) {
        this.logger.warn(`Login attempt with inactive user: ${username}`);
        throw new UnauthorizedException('账户已被禁用');
      }

      const isPasswordValid = await this.usersService.validatePassword(password, user.password);
      
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password for user: ${username}`);
        return null;
      }

      // 移除密码字段
      const { password: _, ...result } = user;
      return result as User;
    } catch (error) {
      this.logger.error(`Error validating user ${username}:`, error);
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(user: User): Promise<LoginResult> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions as Record<string, any> || {},
    };

    const accessToken = this.jwtService.sign(payload);

    // 更新最后登录时间
    await this.usersService.updateLastLoginAt(user.id);

    this.logger.log(`User ${user.username} logged in successfully`);

    return {
      user,
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '7d',
    };
  }

  /**
   * 验证JWT令牌
   */
  async validateJwtPayload(payload: JwtPayload): Promise<UserWithoutPassword | null> {
    try {
      const user = await this.usersService.findOne(payload.sub);
      
      if (!user || user.status !== UserStatus.ACTIVE) {
        return null;
      }

      return user;
    } catch (error) {
      this.logger.error(`Error validating JWT payload:`, error);
      return null;
    }
  }

  /**
   * 刷新令牌
   */
  async refreshToken(user: User): Promise<{ accessToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions as Record<string, any> || {},
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Token refreshed for user ${user.username}`);

    return { accessToken };
  }

  /**
   * 检查用户权限
   */
  hasPermission(user: User, permission: string): boolean {
    if (!user.permissions) {
      return false;
    }

    const permissions = user.permissions as Record<string, any>;
    const [resource, action] = permission.split(':');

    // 管理员拥有所有权限
    if (user.role === 'ADMIN') {
      return true;
    }

    // 检查具体权限
    if (permissions[resource] && Array.isArray(permissions[resource])) {
      return permissions[resource].includes(action);
    }

    return false;
  }

  /**
   * 检查多个权限（需要全部满足）
   */
  hasAllPermissions(user: User, permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  /**
   * 检查多个权限（满足其中一个即可）
   */
  hasAnyPermission(user: User, permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }
}