import { Module } from '@nestjs/common';
import { GitCredentialsController } from './git-credentials.controller';
import { GitCredentialsService } from './git-credentials.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GitCredentialsController],
  providers: [GitCredentialsService],
  exports: [GitCredentialsService],
})
export class GitCredentialsModule {}