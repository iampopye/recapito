/**
 * Unit tests for the TypeORM `encryptedColumn` ValueTransformer.
 *
 * The transformer reads ENCRYPTION_KEY from `process.env` lazily and caches it
 * in module scope. To test key-mismatch behaviour we therefore have to reset
 * the module registry between cases -- `jest.isolateModules` gives each block
 * a fresh copy with a fresh cache.
 */

import type { encryptedColumn } from './encrypted-column.transformer';

const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

// NB: this alias must not be called `Transformer` -- @types/node declares a
// global `Transformer<I, O>` (web streams) that would win and silently turn
// every `.to()` / `.from()` call below into a type error.
type EncryptedColumn = typeof encryptedColumn;

const ORIGINAL_ENV_KEY = process.env.ENCRYPTION_KEY;

/** Load a fresh copy of the transformer bound to `key`. */
const loadWithKey = (key: string | undefined): EncryptedColumn => {
  let loaded!: EncryptedColumn;

  if (key === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = key;
  }

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('./encrypted-column.transformer').encryptedColumn;
  });

  // The module reads ENCRYPTION_KEY lazily and then caches it for its lifetime.
  // Force that read NOW, while the env var still holds `key`, so the returned
  // transformer stays bound to this key even after the environment changes
  // again. Without this, the cross-key test would silently load both
  // transformers with whatever key happened to be set at first use -- and
  // would pass for the wrong reason.
  if (key !== undefined && /^[0-9a-fA-F]{64}$/.test(key)) {
    loaded.to('warm-up');
  }

  return loaded;
};

describe('encryptedColumn transformer', () => {
  let transformer: EncryptedColumn;

  beforeEach(() => {
    transformer = loadWithKey(KEY);
  });

  afterAll(() => {
    if (ORIGINAL_ENV_KEY === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = ORIGINAL_ENV_KEY;
    }
  });

  describe('round trip', () => {
    it.each([
      ['a simple secret', 'imap-password'],
      ['non-ASCII', 'contraseña-日本語-🔐'],
      ['a value containing colons', 'host:993:user:pass'],
      ['a long value', 'y'.repeat(8192)],
    ])('preserves %s through to() and from()', (_label, plaintext) => {
      const stored = transformer.to(plaintext);

      expect(stored).not.toBeNull();
      expect(stored).not.toContain(plaintext);
      expect(stored!.startsWith('v1:')).toBe(true);
      expect(transformer.from(stored)).toBe(plaintext);
    });

    it.each([null, undefined, ''])('maps %p to null in both directions', (input) => {
      expect(transformer.to(input)).toBeNull();
      expect(transformer.from(input)).toBeNull();
    });
  });

  describe('IV uniqueness', () => {
    it('produces different ciphertext for identical plaintext', () => {
      const a = transformer.to('identical-secret');
      const b = transformer.to('identical-secret');

      expect(a).not.toBe(b);
      expect(transformer.from(a)).toBe('identical-secret');
      expect(transformer.from(b)).toBe('identical-secret');
    });

    it('uses a distinct IV on every write', () => {
      const ivs = new Set(Array.from({ length: 200 }, () => transformer.to('same')!.split(':')[1]));
      expect(ivs.size).toBe(200);
    });
  });

  describe('idempotence on write', () => {
    it('does not double-encrypt an already-encrypted value', () => {
      // Re-saving an entity loaded via a partial select must not wrap the
      // ciphertext a second time -- that would be unrecoverable on read.
      const once = transformer.to('secret')!;
      const twice = transformer.to(once);

      expect(twice).toBe(once);
      expect(transformer.from(twice)).toBe('secret');
    });
  });

  describe('tamper detection', () => {
    it('rejects a modified ciphertext body', () => {
      const [v, iv, tag, data] = transformer.to('sensitive')!.split(':');
      const flipped = Buffer.from(data, 'base64url');
      flipped[0] ^= 0xff;

      expect(() => transformer.from([v, iv, tag, flipped.toString('base64url')].join(':'))).toThrow(
        /Failed to decrypt/,
      );
    });

    it('rejects a modified auth tag', () => {
      const [v, iv, tag, data] = transformer.to('sensitive')!.split(':');
      const flipped = Buffer.from(tag, 'base64url');
      flipped[0] ^= 0xff;

      expect(() =>
        transformer.from([v, iv, flipped.toString('base64url'), data].join(':')),
      ).toThrow(/Failed to decrypt/);
    });

    it('rejects a value written under a different key', () => {
      const other = loadWithKey(OTHER_KEY);
      const stored = other.to('cross-key-secret');

      expect(() => transformer.from(stored)).toThrow(/ENCRYPTION_KEY/);
    });
  });

  describe('legacy unencrypted values', () => {
    it.each([
      'plain-old-password',
      'not:encrypted',
      'v2:a:b:c', // right shape, wrong version
      'v1:only:three',
    ])('returns %p from the database unchanged', (legacy) => {
      expect(transformer.from(legacy)).toBe(legacy);
    });

    it('encrypts a legacy value the next time the row is saved', () => {
      const legacy = 'legacy-imap-password';
      const readBack = transformer.from(legacy);

      expect(readBack).toBe(legacy);

      const rewritten = transformer.to(readBack);
      expect(rewritten!.startsWith('v1:')).toBe(true);
      expect(transformer.from(rewritten)).toBe(legacy);
    });
  });

  describe('key validation', () => {
    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['too short', 'deadbeef'],
      ['not hex', 'z'.repeat(64)],
      ['65 hex chars', 'a'.repeat(65)],
    ])('refuses to encrypt with a %s key', (_label, key) => {
      const t = loadWithKey(key);
      expect(() => t.to('secret')).toThrow(/64 hexadecimal characters/);
    });

    it('does not require a key to pass through null or legacy values', () => {
      const t = loadWithKey(undefined);

      // Importing an entity must not force the environment to be loaded --
      // migration tooling and unit tests depend on this.
      expect(t.to(null)).toBeNull();
      expect(t.from(null)).toBeNull();
      expect(t.from('legacy-plaintext')).toBe('legacy-plaintext');
    });
  });

  describe('interoperability with CryptoService', () => {
    it('reads values written by CryptoService and vice versa', async () => {
      // Both implementations must agree on the envelope, otherwise a value
      // written through the entity cannot be read through the service.
      const { Test } = await import('@nestjs/testing');
      const { ConfigService } = await import('@nestjs/config');
      const { CryptoService } = await import('./crypto.service');

      const module = await Test.createTestingModule({
        providers: [
          CryptoService,
          { provide: ConfigService, useValue: { get: jest.fn(() => KEY) } },
        ],
      }).compile();
      const svc = module.get(CryptoService);
      svc.onModuleInit();

      expect(transformer.from(svc.encrypt('shared-secret'))).toBe('shared-secret');
      expect(svc.decrypt(transformer.to('shared-secret'))).toBe('shared-secret');
    });
  });
});
