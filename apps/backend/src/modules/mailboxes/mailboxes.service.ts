import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mailbox } from '../../entities/mailbox.entity';
import { CreateMailboxDto } from './dto/create-mailbox.dto';
import { UpdateMailboxDto } from './dto/update-mailbox.dto';

@Injectable()
export class MailboxesService {
  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
  ) {}

  async create(userId: string, dto: CreateMailboxDto): Promise<Mailbox> {
    const mailbox = this.mailboxRepository.create({
      ...dto,
      userId,
    });
    return this.mailboxRepository.save(mailbox);
  }

  async findAllByUser(userId: string): Promise<Mailbox[]> {
    return this.mailboxRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId: string): Promise<Mailbox> {
    const mailbox = await this.mailboxRepository.findOne({
      where: { id, userId },
      relations: ['smtpProvider'],
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }
    return mailbox;
  }

  async findByIdWithProvider(id: string, userId: string): Promise<Mailbox> {
    const mailbox = await this.mailboxRepository.findOne({
      where: { id, userId },
      relations: ['smtpProvider'],
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }
    return mailbox;
  }

  async findAllActive(): Promise<Mailbox[]> {
    return this.mailboxRepository.find({
      where: { isActive: true },
    });
  }

  async update(id: string, userId: string, dto: UpdateMailboxDto): Promise<Mailbox> {
    const mailbox = await this.findById(id, userId);
    Object.assign(mailbox, dto);
    return this.mailboxRepository.save(mailbox);
  }

  async updateLastSync(id: string, lastUid: number): Promise<void> {
    await this.mailboxRepository.update(id, {
      lastSyncAt: new Date(),
      lastUid,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const mailbox = await this.findById(id, userId);
    await this.mailboxRepository.remove(mailbox);
  }
}
