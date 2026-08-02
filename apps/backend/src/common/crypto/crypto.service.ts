import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Reversible encryption for third-party credentials at rest.
 *
 * Why not bcrypt/argon2? Those are one-way hashes, correct for the user's own
 * login password (see UsersService) because we only ever need to *verify* it.
 * IMAP and SMTP credentials are different: we have to present the original
 * plaintext to the remote server on every connection, so it must be
 * decryptable. Hashing them would break the product; storing them raw -- which
 * is what this codebase did -- means a single database read exposes every
 * user's real email account password.
 *
 * Scheme: AES-256-GCM with a random 96-bit IV per value. GCM is authenticated,
 * so tampering with stored ciphertext is detected on decrypt rather than
 * silently yielding garbage that gets sent to a mail server.
 *
 * Stored format (all base64url, ':'-delimited, version-prefixed):
 *
 *     v1:<iv>:<authTag>:<ciphertext>
 *
 * The version prefix means a future key rotation or algorithm change can be
 * introduced without guessing at what old rows contain.
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_BYTES = 12; // 96-bit, the GCM-recommended size
  private static readonly VERSION = 'v1';

  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    // env.validation.ts guarantees this exists and is 64 hex chars, so the
    // app can never reach this point with a weak or missing key.
    const hex = this.configService.get<string>('ENCRYPTION_KEY', '');
    this.key = Buffer.from(hex, 'hex');
  }

  onModuleInit(): void {
    if (this.key.length !== 32) {
      // Defensive: validation should have caught this long before now.
      throw new Error(
        'ENCRYPTION_KEY did not decode to 32 bytes. Regenerate it with: openssl rand -hex 32',
      );
    }
    this.logger.log('Credential encryption initialised (AES-256-GCM)');
  }

  /**
   * Encrypt a plaintext credential. Returns null for null/empty input so that
   * nullable columns stay nullable rather than storing an encrypted empty
   * string that later decrypts to '' and silently fails authentication.
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined || plaintext === '') {
      return null;
    }

    const iv = randomBytes(CryptoService.IV_BYTES);
    const cipher = createCipheriv(CryptoService.ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      CryptoService.VERSION,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  /**
   * Decrypt a stored credential.
   *
   * Values that are not in the versioned format are returned unchanged. That
   * is deliberate: it lets rows written before encryption was introduced keep
   * working while the backfill migration runs, instead of breaking every
   * mailbox the moment this deploys. `isEncrypted()` lets callers detect and
   * re-save those rows.
   */
  decrypt(stored: string | null | undefined): string | null {
    if (stored === null || stored === undefined || stored === '') {
      return null;
    }
    if (!this.isEncrypted(stored)) {
      return stored;
    }

    const [, ivPart, tagPart, dataPart] = stored.split(':');

    try {
      const decipher = createDecipheriv(
        CryptoService.ALGORITHM,
        this.key,
        Buffer.from(ivPart, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

      return Buffer.concat([
        decipher.update(Buffer.from(dataPart, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Never log the ciphertext or the key. The overwhelmingly likely cause
      // is that ENCRYPTION_KEY changed, so say that instead of leaking bytes.
      throw new Error(
        'Failed to decrypt a stored credential. This usually means ENCRYPTION_KEY ' +
          'differs from the one used to encrypt it. Restore the original key, or ' +
          're-enter the affected mailbox and provider credentials.',
      );
    }
  }

  /** True when the value is in this service's versioned envelope format. */
  isEncrypted(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }
    const parts = value.split(':');
    return parts.length === 4 && parts[0] === CryptoService.VERSION;
  }

  /**
   * Constant-time comparison, for verifying webhook signatures and similar.
   * A plain `===` on secrets leaks length and prefix through timing.
   */
  safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Mask a secret for display, e.g. in an API response or a log line.
   * Shows the last 4 characters only, so a user can recognise which key is
   * configured without the value being recoverable.
   */
  mask(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    if (value.length <= 4) {
      return '****';
    }
    return `****${value.slice(-4)}`;
  }
}
