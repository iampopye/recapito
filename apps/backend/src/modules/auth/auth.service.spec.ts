import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import type { User } from '../../entities/user.entity';

/**
 * Unit tests for AuthService.
 *
 * UsersService and JwtService are replaced with mocks, so nothing here touches
 * Postgres. bcrypt is NOT mocked: the whole point of several of these tests is
 * that a real hash is produced and really verified. bcrypt with cost 10 is
 * fast enough that a handful of calls stays well inside the default timeout.
 */
/**
 * Awaits a promise that is expected to reject and returns the thrown Error.
 * Fails loudly if it resolves instead -- a silently-resolving "rejection" test
 * would otherwise pass while asserting nothing.
 */
const captureRejection = async (promise: Promise<unknown>): Promise<Error> => {
  let captured: Error | undefined;
  await promise.catch((error: unknown) => {
    captured = error as Error;
  });
  if (!captured) {
    throw new Error('Expected the promise to reject, but it resolved.');
  }
  return captured;
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'create' | 'count'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let config: Record<string, string>;

  /** Builds a persisted-looking User with a real bcrypt hash of `password`. */
  const makeUser = async (password: string, overrides: Partial<User> = {}): Promise<User> =>
    ({
      id: 'user-uuid-1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      passwordHash: await bcrypt.hash(password, 10),
      isAdmin: false,
      mailboxes: [],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    }) as User;

  beforeEach(async () => {
    // Registration is gated: closed by default, always open for the very first
    // account. Most tests below want an already-bootstrapped, open instance,
    // so that is the default here and individual tests override it.
    config = { ALLOW_REGISTRATION: 'true' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            count: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed.jwt.token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('registration gating', () => {
    it('allows the very first account even when registration is closed', async () => {
      config = { ALLOW_REGISTRATION: 'false' };
      usersService.count.mockResolvedValue(0);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(await makeUser('pw', { isAdmin: true }));

      const result = await service.register({
        email: 'first@example.com',
        name: 'First',
        password: 'pw-long-enough',
      });

      // Bootstrapping must always be possible, otherwise a fresh deployment
      // is permanently locked out.
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(usersService.create.mock.calls[0][0].isAdmin).toBe(true);
    });

    it('refuses a second account when registration is closed', async () => {
      config = { ALLOW_REGISTRATION: 'false' };
      usersService.count.mockResolvedValue(1);

      await expect(
        service.register({ email: 'second@example.com', name: 'Second', password: 'pw-long' }),
      ).rejects.toThrow(ForbiddenException);

      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('is closed by default when ALLOW_REGISTRATION is unset', async () => {
      config = {};
      usersService.count.mockResolvedValue(1);

      await expect(
        service.register({ email: 'second@example.com', name: 'Second', password: 'pw-long' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it.each(['TRUE', 'True', 'true'])('accepts %p as opening registration', async (value) => {
      config = { ALLOW_REGISTRATION: value };
      usersService.count.mockResolvedValue(1);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(await makeUser('pw'));

      await expect(
        service.register({ email: 'n@example.com', name: 'N', password: 'pw-long' }),
      ).resolves.toBeDefined();
    });

    it('does not grant admin to accounts after the first', async () => {
      usersService.count.mockResolvedValue(3);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(await makeUser('pw'));

      await service.register({ email: 'n@example.com', name: 'N', password: 'pw-long' });

      expect(usersService.create.mock.calls[0][0].isAdmin).toBe(false);
    });
  });

  describe('register', () => {
    it('stores a bcrypt hash, never the raw password', async () => {
      const plaintext = 'correct horse battery staple';
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (data) =>
        makeUser('unused', {
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
        }),
      );

      await service.register({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        password: plaintext,
      });

      expect(usersService.create).toHaveBeenCalledTimes(1);
      const [createArg] = usersService.create.mock.calls[0];

      // The raw password must not survive anywhere in the persisted payload.
      expect(JSON.stringify(createArg)).not.toContain(plaintext);
      expect(createArg.passwordHash).not.toBe(plaintext);

      // It must be a real, verifiable bcrypt hash -- not just any transform.
      expect(createArg.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      await expect(bcrypt.compare(plaintext, createArg.passwordHash)).resolves.toBe(true);
    });

    it('produces a different hash each time for the same password (salted)', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (data) =>
        makeUser('unused', { passwordHash: data.passwordHash }),
      );

      const payload = { email: 'ada@example.com', name: 'Ada', password: 'same-password' };
      await service.register(payload);
      await service.register(payload);

      const first = usersService.create.mock.calls[0][0].passwordHash;
      const second = usersService.create.mock.calls[1][0].passwordHash;
      expect(first).not.toBe(second);
    });

    it('returns a token and a user projection that omits the password hash', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(await makeUser('pw'));

      const result = await service.register({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        password: 'pw-long-enough',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: 'user-uuid-1',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        isAdmin: false,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-uuid-1' });
    });

    it('rejects a duplicate email without creating a user', async () => {
      usersService.findByEmail.mockResolvedValue(await makeUser('pw'));

      await expect(
        service.register({ email: 'ada@example.com', name: 'Ada', password: 'pw-long-enough' }),
      ).rejects.toThrow(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token when the password is correct', async () => {
      const password = 'sup3r-s3cret';
      usersService.findByEmail.mockResolvedValue(await makeUser(password));

      const result = await service.login({ email: 'ada@example.com', password });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.id).toBe('user-uuid-1');
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-uuid-1' });
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(await makeUser('the-real-password'));

      await expect(
        service.login({ email: 'ada@example.com', password: 'not-the-password' }),
      ).rejects.toThrow(UnauthorizedException);

      // No token may be minted on a failed authentication.
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('rejects an unknown user', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('gives the same error message for unknown user and wrong password', async () => {
      // Distinguishable errors turn the login endpoint into an account
      // enumeration oracle. Both paths must be indistinguishable to a caller.
      usersService.findByEmail.mockResolvedValue(null);
      const unknownUserError = await captureRejection(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      );

      usersService.findByEmail.mockResolvedValue(await makeUser('the-real-password'));
      const wrongPasswordError = await captureRejection(
        service.login({ email: 'ada@example.com', password: 'wrong' }),
      );

      expect(unknownUserError).toBeInstanceOf(UnauthorizedException);
      expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
      expect(unknownUserError.message).toBe(wrongPasswordError.message);
      expect(unknownUserError.message).toBe('Invalid credentials');
      expect(unknownUserError.constructor).toBe(wrongPasswordError.constructor);
    });

    it('does not leak the password hash in the response', async () => {
      const password = 'sup3r-s3cret';
      usersService.findByEmail.mockResolvedValue(await makeUser(password));

      const result = await service.login({ email: 'ada@example.com', password });

      expect(JSON.stringify(result)).not.toContain('$2');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });
});
