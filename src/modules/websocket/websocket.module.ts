import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BuildGateway } from './gateways/build.gateway';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({}), // 配置将从全局配置中继承
  ],
  providers: [BuildGateway],
  exports: [BuildGateway],
})
export class WebsocketModule {}