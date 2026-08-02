import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { UsersService } from './users.service';
import { User } from '../../entities/user.entity';

/**
 * Unit tests for UsersService.
 *
 * The TypeORM repository is provided as a jest mock via `getRepositoryToken`,
 * which is how NestJS resolves `@InjectRepository(User)`. No database is
 * involved. `create` is stubbed to behave like the real one (merge the partial
 * onto a new object) so that assertions about what gets saved are meaningful.
 */
describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  const baseUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-uuid-1',
      email: 'grace@example.com',
      name: 'Grace Hopper',
      passwordHash: 'existing-hash',
      isAdmin: false,
      mailboxes: [],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    }) as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn((dto) => ({ ...dto })),
            save: jest.fn((entity) => Promise.resolve(entity)),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  describe('createUser', () => {
    it('hashes the password and never persists the plaintext', async () => {
      const plaintext = 'hunter2-but-longer';
      repo.findOne.mockResolvedValue(null);

      await service.createUser({
        email: 'grace@example.com',
        name: 'Grace Hopper',
        password: plaintext,
      });

      expect(repo.create).toHaveBeenCalledTimes(1);
      const created = repo.create.mock.calls[0][0] as Partial<User>;

      expect(created.passwordHash).toBeDefined();
      expect(created.passwordHash).not.toBe(plaintext);
      expect(created.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      await expect(bcrypt.compare(plaintext, created.passwordHash as string)).resolves.toBe(true);

      // The DTO's `password` field must not be carried through to the entity.
      expect(created).not.toHaveProperty('password');
      expect(JSON.stringify(created)).not.toContain(plaintext);
    });

    it('defaults isAdmin to false when not supplied', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.createUser({
        email: 'grace@example.com',
        name: 'Grace Hopper',
        password: 'a-password',
      });

      expect((repo.create.mock.calls[0][0] as Partial<User>).isAdmin).toBe(false);
    });

    it('rejects a duplicate email before hashing or saving', async () => {
      repo.findOne.mockResolvedValue(baseUser());

      await expect(
        service.createUser({
          email: 'grace@example.com',
          name: 'Grace Hopper',
          password: 'a-password',
        }),
      ).rejects.toThrow(ConflictException);

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('re-hashes the password when a new one is supplied', async () => {
      const user = baseUser();
      const newPassword = 'a-brand-new-password';
      repo.findOne.mockResolvedValue(user);

      const result = await service.updateUser('user-uuid-1', { password: newPassword });

      expect(result.passwordHash).not.toBe('existing-hash');
      expect(result.passwordHash).not.toBe(newPassword);
      expect(result.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      await expect(bcrypt.compare(newPassword, result.passwordHash)).resolves.toBe(true);
      expect(repo.save).toHaveBeenCalledWith(user);
    });

    it('leaves the existing hash untouched when no password is supplied', async () => {
      repo.findOne.mockResolvedValue(baseUser());

      const result = await service.updateUser('user-uuid-1', { name: 'Grace B. Hopper' });

      expect(result.passwordHash).toBe('existing-hash');
      expect(result.name).toBe('Grace B. Hopper');
    });

    it('produces a different hash than a previous hash of the same password', async () => {
      const password = 'repeated-password';
      const firstHash = await bcrypt.hash(password, 10);
      repo.findOne.mockResolvedValue(baseUser({ passwordHash: firstHash }));

      const result = await service.updateUser('user-uuid-1', { password });

      // Salted: same input, different stored value.
      expect(result.passwordHash).not.toBe(firstHash);
      await expect(bcrypt.compare(password, result.passwordHash)).resolves.toBe(true);
    });

    it('rejects an email that belongs to another user', async () => {
      repo.findOne
        .mockResolvedValueOnce(baseUser()) // findById
        .mockResolvedValueOnce(baseUser({ id: 'someone-else', email: 'taken@example.com' }));

      await expect(
        service.updateUser('user-uuid-1', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.updateUser('does-not-exist', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('persists a pre-hashed password verbatim', async () => {
      // `create` is the low-level path used by AuthService.register, which has
      // already hashed. It must not double-hash.
      const passwordHash = await bcrypt.hash('already-hashed', 10);

      const result = await service.create({
        email: 'grace@example.com',
        name: 'Grace Hopper',
        passwordHash,
      });

      expect(result.passwordHash).toBe(passwordHash);
    });
  });

  describe('findAll', () => {
    it('never selects the password hash column', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll();

      const options = repo.find.mock.calls[0][0];
      expect(options?.select).toBeDefined();
      expect(options?.select).not.toContain('passwordHash');
    });
  });

  describe('deleteUser', () => {
    it('throws NotFoundException instead of removing nothing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deleteUser('does-not-exist')).rejects.toThrow(NotFoundException);
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
