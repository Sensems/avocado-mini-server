import { Module } from '@nestjs/common';
import { GitOperationService } from './services/git-operation.service';
import { EncryptionService } from './services/encryption.service';
import { GitCredentialsModule } from '../modules/git-credentials/git-credentials.module';

@Module({
  imports: [GitCredentialsModule],
  providers: [GitOperationService, EncryptionService],
  exports: [GitOperationService, EncryptionService],
})
export class CommonModule {}