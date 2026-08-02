import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { CryptoService } from './crypto.service';

/**
 * Unit tests for CryptoService (AES-256-GCM credential encryption).
 *
 * These exercise the security properties the scheme is supposed to provide,
 * not just that encrypt/decrypt are inverses:
 *   - round-trip fidelity, including non-ASCII and long values
 *   - authenticated encryption: tampering is DETECTED, not silently accepted
 *   - IV uniqueness: identical plaintext must not produce identical ciphertext
 *   - legacy passthrough: pre-encryption rows keep working during backfill
 */
describe('CryptoService', () => {
  // Deterministic 32-byte test key. Not a secret, and not used anywhere real.
  const KEY = 'a'.repeat(64);
  const OTHER_KEY = 'b'.repeat(64);

  const build = async (hexKey: string): Promise<CryptoService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) =>
              key === 'ENCRYPTION_KEY' ? hexKey : fallback,
            ),
          },
        },
      ],
    }).compile();

    const service = module.get(CryptoService);
    service.onModuleInit();
    return service;
  };

  let service: CryptoService;

  beforeEach(async () => {
    service = await build(KEY);
  });

  describe('initialisation', () => {
    it('rejects a key that does not decode to 32 bytes', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CryptoService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => 'deadbeef') }, // 4 bytes, far too short
          },
        ],
      }).compile();

      expect(() => module.get(CryptoService).onModuleInit()).toThrow(/32 bytes/);
    });
  });

  describe('round trip', () => {
    it.each([
      ['a simple password', 'hunter2'],
      ['an app password with spaces', 'abcd efgh ijkl mnop'],
      ['non-ASCII', 'pässwörd-日本語-🔐'],
      ['a value containing the delimiter', 'a:b:c:d:e'],
      ['a long value', 'x'.repeat(4096)],
      ['a single character', 'x'],
    ])('preserves %s exactly', (_label, plaintext) => {
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).not.toBeNull();
      expect(service.decrypt(encrypted)).toBe(plaintext);

      // Only meaningful for inputs long enough that an accidental substring
      // match in base64url output is not plausible -- a 1-character plaintext
      // will legitimately appear in the ciphertext alphabet by chance.
      if (plaintext.length >= 8) {
        expect(encrypted).not.toContain(plaintext);
      }
    });

    it('emits the documented v1 envelope format', () => {
      const encrypted = service.encrypt('secret');
      const parts = encrypted!.split(':');

      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1');
      // 12-byte IV and 16-byte auth tag, base64url encoded.
      expect(Buffer.from(parts[1], 'base64url')).toHaveLength(12);
      expect(Buffer.from(parts[2], 'base64url')).toHaveLength(16);
    });

    it.each([null, undefined, ''])('maps %p to null on encrypt', (input) => {
      expect(service.encrypt(input)).toBeNull();
    });

    it.each([null, undefined, ''])('maps %p to null on decrypt', (input) => {
      expect(service.decrypt(input)).toBeNull();
    });
  });

  describe('IV uniqueness', () => {
    it('produces different ciphertext for identical plaintext', () => {
      const a = service.encrypt('identical-secret');
      const b = service.encrypt('identical-secret');

      expect(a).not.toBe(b);
      expect(service.decrypt(a)).toBe('identical-secret');
      expect(service.decrypt(b)).toBe('identical-secret');
    });

    it('uses a distinct IV on every call', () => {
      const ivs = new Set(
        Array.from({ length: 200 }, () => service.encrypt('same')!.split(':')[1]),
      );

      // 200 random 96-bit IVs colliding is astronomically unlikely; any
      // repetition here means the IV is not actually random per call, which
      // would be a catastrophic GCM misuse.
      expect(ivs.size).toBe(200);
    });
  });

  describe('tamper detection', () => {
    it('rejects a modified ciphertext body', () => {
      const [v, iv, tag, data] = service.encrypt('sensitive')!.split(':');
      const flipped = Buffer.from(data, 'base64url');
      flipped[0] ^= 0xff;

      const tampered = [v, iv, tag, flipped.toString('base64url')].join(':');
      expect(() => service.decrypt(tampered)).toThrow(/Failed to decrypt/);
    });

    it('rejects a modified auth tag', () => {
      const [v, iv, tag, data] = service.encrypt('sensitive')!.split(':');
      const flipped = Buffer.from(tag, 'base64url');
      flipped[0] ^= 0xff;

      const tampered = [v, iv, flipped.toString('base64url'), data].join(':');
      expect(() => service.decrypt(tampered)).toThrow(/Failed to decrypt/);
    });

    it('rejects a swapped IV', () => {
      const [v, , tag, data] = service.encrypt('sensitive')!.split(':');
      const otherIv = service.encrypt('anything else')!.split(':')[1];

      expect(() => service.decrypt([v, otherIv, tag, data].join(':'))).toThrow(/Failed to decrypt/);
    });

    it('rejects ciphertext encrypted under a different key', async () => {
      const other = await build(OTHER_KEY);
      const encrypted = other.encrypt('cross-key-secret');

      expect(() => service.decrypt(encrypted)).toThrow(/ENCRYPTION_KEY/);
    });

    it('never includes the key or the ciphertext in the error message', async () => {
      const other = await build(OTHER_KEY);
      const encrypted = other.encrypt('cross-key-secret')!;

      const error = (() => {
        try {
          service.decrypt(encrypted);
          return null;
        } catch (e) {
          return e as Error;
        }
      })();

      expect(error).not.toBeNull();
      expect(error!.message).not.toContain(KEY);
      expect(error!.message).not.toContain(OTHER_KEY);
      expect(error!.message).not.toContain(encrypted);
    });
  });

  describe('legacy unencrypted values', () => {
    it.each([
      'plain-old-password',
      'not:encrypted',
      'v2:a:b:c', // right shape, wrong version
      'v1:only:three',
      'v1:a:b:c:d', // five parts
    ])('returns %p unchanged', (legacy) => {
      expect(service.decrypt(legacy)).toBe(legacy);
    });

    it('reports legacy values as not encrypted', () => {
      expect(service.isEncrypted('plain-old-password')).toBe(false);
      expect(service.isEncrypted('')).toBe(false);
      expect(service.isEncrypted(null)).toBe(false);
      expect(service.isEncrypted(undefined)).toBe(false);
    });

    it('reports its own output as encrypted', () => {
      expect(service.isEncrypted(service.encrypt('secret'))).toBe(true);
    });

    it('can re-encrypt a legacy value in place', () => {
      const legacy = 'legacy-imap-password';

      expect(service.isEncrypted(legacy)).toBe(false);
      const migrated = service.encrypt(service.decrypt(legacy));

      expect(service.isEncrypted(migrated)).toBe(true);
      expect(service.decrypt(migrated)).toBe(legacy);
    });
  });

  describe('safeEqual', () => {
    it('matches identical strings', () => {
      expect(service.safeEqual('signature-abc', 'signature-abc')).toBe(true);
    });

    it('rejects different strings of equal length', () => {
      expect(service.safeEqual('signature-abc', 'signature-abd')).toBe(false);
    });

    it('rejects strings of different length without throwing', () => {
      // timingSafeEqual throws on length mismatch; the guard must handle it.
      expect(service.safeEqual('short', 'much-longer-value')).toBe(false);
    });

    it('handles empty strings', () => {
      expect(service.safeEqual('', '')).toBe(true);
      expect(service.safeEqual('', 'x')).toBe(false);
    });
  });

  describe('mask', () => {
    it('reveals only the last four characters', () => {
      expect(service.mask('key-abcdefgh1234')).toBe('****1234');
    });

    it('fully masks short values', () => {
      expect(service.mask('abcd')).toBe('****');
      expect(service.mask('a')).toBe('****');
    });

    it.each([null, undefined, ''])('maps %p to null', (input) => {
      expect(service.mask(input)).toBeNull();
    });
  });
});
