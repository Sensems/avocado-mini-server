import { Module } from '@nestjs/common';
import { MiniprogramsController } from './miniprograms.controller';
import { MiniprogramsService } from './miniprograms.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MiniprogramsController],
  providers: [MiniprogramsService],
  exports: [MiniprogramsService],
})
export class MiniprogramsModule {}