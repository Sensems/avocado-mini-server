import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../../users/users.service';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

@WebSocketGateway({
  namespace: '/build',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class BuildGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BuildGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // 从查询参数或头部获取token
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }
      // 验证JWT token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      const user = await this.usersService.findOne(payload.sub);
      
      if (!user) {
        this.logger.warn(`Client ${client.id} connected with invalid user`);
        client.disconnect();
        return;
      }

      // 设置用户信息
      client.userId = user.id;
      client.username = user.username;
      
      // 加入用户专属房间
      await client.join(`user:${user.id}`);
      
      // 记录连接
      this.connectedClients.set(client.id, client);
      
      this.logger.log(`User ${user.username} (${user.id}) connected via WebSocket`);
      
      // 发送连接成功消息
      client.emit('connected', {
        message: '连接成功',
        userId: user.id,
        username: user.username,
      });

    } catch (error) {
      this.logger.error(`WebSocket authentication failed for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    
    if (client.userId) {
      this.logger.log(`User ${client.username} (${client.userId}) disconnected from WebSocket`);
    } else {
      this.logger.log(`Client ${client.id} disconnected from WebSocket`);
    }
  }

  /**
   * 订阅构建任务
   */
  @SubscribeMessage('subscribe-task')
  async handleSubscribeTask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string },
  ) {
    if (!client.userId) {
      client.emit('error', { message: '未认证' });
      return;
    }
    const { taskId } = data;
    
    // 加入任务房间
    await client.join(`task:${taskId}`);
    
    this.logger.log(`User ${client.username} subscribed to task ${taskId}`);
    
    client.emit('subscribed', {
      taskId,
      message: `已订阅任务 ${taskId}`,
    });
  }

  /**
   * 取消订阅构建任务
   */
  @SubscribeMessage('unsubscribe-task')
  async handleUnsubscribeTask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string },
  ) {
    if (!client.userId) {
      client.emit('error', { message: '未认证' });
      return;
    }

    const { taskId } = data;
    
    // 离开任务房间
    await client.leave(`task:${taskId}`);
    
    this.logger.log(`User ${client.username} unsubscribed from task ${taskId}`);
    
    client.emit('unsubscribed', {
      taskId,
      message: `已取消订阅任务 ${taskId}`,
    });
  }

  /**
   * 发送构建日志
   */
  sendBuildLog(taskId: string, log: string, level: 'info' | 'warn' | 'error' = 'info') {
    this.server.to(`task:${taskId}`).emit('build-log', {
      taskId,
      log,
      level,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发送构建状态变更（包含进度、消息和结果）
   */
  sendBuildStatus(taskId: string, status: string, data?: { progress?: number; message?: string; result?: any }) {
    this.server.to(`task:${taskId}`).emit('build-status', {
      taskId,
      status,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 向用户发送消息
   */
  sendToUser(userId: number, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 广播消息给所有连接的客户端
   */
  broadcast(event: string, data: any) {
    this.server.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取在线用户数量
   */
  getOnlineUserCount(): number {
    return this.connectedClients.size;
  }

  /**
   * 获取在线用户列表
   */
  getOnlineUsers(): Array<{ userId: number; username: string; socketId: string }> {
    return Array.from(this.connectedClients.values()).map(client => ({
      userId: client.userId,
      username: client.username,
      socketId: client.id,
    })).filter(user => user.userId);
  }
}