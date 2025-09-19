import { Module } from '@nestjs/common';
import { NotificationConfigsController } from './notification-configs.controller';
import { NotificationConfigsService } from './notification-configs.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationConfigsController],
  providers: [NotificationConfigsService],
  exports: [NotificationConfigsService],
})
export class NotificationConfigsModule {}