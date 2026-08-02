import type { ValueTransformer } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * TypeORM column transformer that encrypts on write and decrypts on read.
 *
 * Applying this to a @Column means an entity field is plaintext everywhere in
 * application code but ciphertext everywhere in the database. Nothing else has
 * to remember to call encrypt() -- which is the point, because "remember to
 * encrypt before saving" is a rule that gets forgotten in exactly the one code
 * path that matters.
 *
 * This deliberately duplicates a little of CryptoService rather than injecting
 * it: TypeORM instantiates transformers at class-decoration time, long before
 * the Nest DI container exists, so there is no service to inject yet. The key
 * is read lazily on first use so that importing an entity does not require the
 * environment to be loaded (which would break migration tooling and tests).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }
  const hex = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ENCRYPTION_KEY must be 64 hexadecimal characters (a 32-byte AES-256 key). ' +
        'Generate one with: openssl rand -hex 32',
    );
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 4 && parts[0] === VERSION;
}

export const encryptedColumn: ValueTransformer = {
  /** Application value -> database value. */
  to(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    // Idempotent: re-saving an entity that was loaded without decryption
    // (e.g. a partial select) must not double-encrypt.
    if (isEncrypted(value)) {
      return value;
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

    return [
      VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  },

  /** Database value -> application value. */
  from(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    // Rows written before encryption was introduced are returned as-is so the
    // app keeps working during the backfill migration.
    if (!isEncrypted(value)) {
      return value;
    }

    const [, ivPart, tagPart, dataPart] = value.split(':');
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        getKey(),
        Buffer.from(ivPart, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(dataPart, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error(
        'Failed to decrypt a stored credential. ENCRYPTION_KEY has most likely ' +
          'changed since it was written. Restore the original key, or re-enter ' +
          'the affected credentials.',
      );
    }
  },
};
