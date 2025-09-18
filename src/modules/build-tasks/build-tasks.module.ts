import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BuildTasksController } from './build-tasks.controller';
import { BuildTasksService } from './build-tasks.service';
import { BuildProcessor } from './processors/build.processor';
import { BuildService } from './services/build.service';
import { MiniprogramsModule } from '../miniprograms/miniprograms.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MiniprogramsModule,
    BullModule.registerQueue({
      name: 'build',
    }),
  ],
  controllers: [BuildTasksController],
  providers: [BuildTasksService, BuildProcessor, BuildService],
  exports: [BuildTasksService],
})
export class BuildTasksModule {}