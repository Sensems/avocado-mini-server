import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MiniprogramsModule } from './modules/miniprograms/miniprograms.module';
import { BuildTasksModule } from './modules/build-tasks/build-tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { GitCredentialsModule } from './modules/git-credentials/git-credentials.module';
import { NotificationConfigsModule } from './modules/notification-configs/notification-configs.module';
import { SystemModule } from './modules/system/system.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { RedisModule } from './modules/redis/redis.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import configuration from './config/configuration';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // 限流模块
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1分钟
        limit: 100, // 100次请求
      },
    ]),

    // Redis队列模块
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB) || 0,
        },
      }),
    }),

    // 核心模块
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    MiniprogramsModule,
    BuildTasksModule,
    NotificationsModule,
    GitCredentialsModule,
    NotificationConfigsModule,
    SystemModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}