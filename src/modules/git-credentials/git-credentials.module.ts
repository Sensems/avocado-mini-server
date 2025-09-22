import { Module } from '@nestjs/common';
import { GitCredentialsController } from './git-credentials.controller';
import { GitCredentialsService } from './git-credentials.service';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [AuthModule],
  controllers: [GitCredentialsController],
  providers: [GitCredentialsService, EncryptionService],
  exports: [GitCredentialsService],
})
export class GitCredentialsModule {}