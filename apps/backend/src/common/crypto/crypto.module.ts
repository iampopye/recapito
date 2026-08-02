import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './crypto.service';

/**
 * Global so that any module storing third-party credentials (mailboxes,
 * smtp-providers, settings) can inject CryptoService without each one having
 * to remember to import this module. Forgetting the import is exactly how a
 * credential ends up written in plaintext.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
