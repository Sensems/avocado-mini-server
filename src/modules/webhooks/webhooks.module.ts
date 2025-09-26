import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BuildTasksModule } from '../build-tasks/build-tasks.module';
import { MiniprogramsModule } from '../miniprograms/miniprograms.module';

@Module({
  imports: [
    PrismaModule,
    BuildTasksModule,
    MiniprogramsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}