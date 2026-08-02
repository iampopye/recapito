import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Label } from '../../entities/label.entity';
import { Thread } from '../../entities/thread.entity';
import { Mailbox } from '../../entities/mailbox.entity';

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(Label)
    private readonly labelRepository: Repository<Label>,
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
  ) {}

  async findAllByUser(userId: string): Promise<Label[]> {
    return this.labelRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async create(userId: string, data: { name: string; color?: string }): Promise<Label> {
    const existing = await this.labelRepository.findOne({
      where: { userId, name: data.name },
    });
    if (existing) {
      throw new BadRequestException('Label with this name already exists');
    }

    const label = this.labelRepository.create({
      userId,
      name: data.name,
      color: data.color || '#3B82F6',
    });
    return this.labelRepository.save(label);
  }

  async update(id: string, userId: string, data: { name?: string; color?: string }): Promise<Label> {
    const label = await this.labelRepository.findOne({
      where: { id, userId },
    });
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    if (data.name) {
      const existing = await this.labelRepository.findOne({
        where: { userId, name: data.name },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Label with this name already exists');
      }
      label.name = data.name;
    }
    if (data.color) {
      label.color = data.color;
    }

    return this.labelRepository.save(label);
  }

  async delete(id: string, userId: string): Promise<void> {
    const label = await this.labelRepository.findOne({
      where: { id, userId },
    });
    if (!label) {
      throw new NotFoundException('Label not found');
    }
    await this.labelRepository.remove(label);
  }

  async addLabelToThread(threadId: string, labelId: string, userId: string): Promise<Thread> {
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    const thread = await this.threadRepository.findOne({
      where: { id: threadId, mailboxId: In(mailboxIds) },
      relations: ['labels'],
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const label = await this.labelRepository.findOne({
      where: { id: labelId, userId },
    });
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    if (!thread.labels) {
      thread.labels = [];
    }
    if (!thread.labels.find((l) => l.id === labelId)) {
      thread.labels.push(label);
      await this.threadRepository.save(thread);
    }

    return thread;
  }

  async removeLabelFromThread(threadId: string, labelId: string, userId: string): Promise<Thread> {
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    const thread = await this.threadRepository.findOne({
      where: { id: threadId, mailboxId: In(mailboxIds) },
      relations: ['labels'],
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (thread.labels) {
      thread.labels = thread.labels.filter((l) => l.id !== labelId);
      await this.threadRepository.save(thread);
    }

    return thread;
  }

  async getThreadsByLabel(labelId: string, userId: string): Promise<Thread[]> {
    const label = await this.labelRepository.findOne({
      where: { id: labelId, userId },
    });
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    return this.threadRepository
      .createQueryBuilder('thread')
      .innerJoin('thread.labels', 'label', 'label.id = :labelId', { labelId })
      .where('thread.mailbox_id IN (:...mailboxIds)', { mailboxIds })
      .orderBy('thread.last_message_at', 'DESC')
      .getMany();
  }
}
