import { Module } from '@nestjs/common';
import { GitOperationsController } from './git-operations.controller';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    CommonModule,
  ],
  controllers: [GitOperationsController],
  exports: [],
})
export class GitOperationsModule {}