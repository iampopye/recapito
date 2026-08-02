import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';

interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
  isAdmin?: boolean;
}

interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  isAdmin?: boolean;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  isAdmin?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Total user count. Used to detect a fresh install: the first account to
   * register becomes the administrator and closes open registration.
   */
  async count(): Promise<number> {
    return this.userRepository.count();
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'name', 'isAdmin', 'createdAt', 'updatedAt'],
    });
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      isAdmin: dto.isAdmin || false,
    });

    return this.userRepository.save(user);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      user.email = dto.email;
    }

    if (dto.name) user.name = dto.name;
    if (dto.isAdmin !== undefined) user.isAdmin = dto.isAdmin;
    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.userRepository.save(user);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.remove(user);
  }

  async makeFirstUserAdmin(): Promise<void> {
    const users = await this.userRepository.find({ take: 1, order: { createdAt: 'ASC' } });
    if (users.length > 0 && !users[0].isAdmin) {
      users[0].isAdmin = true;
      await this.userRepository.save(users[0]);
    }
  }
}
