import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not, LessThanOrEqual } from 'typeorm';
import { Draft } from '../../entities/draft.entity';
import { Mailbox } from '../../entities/mailbox.entity';

interface CreateDraftDto {
  mailboxId: string;
  threadId?: string;
  inReplyTo?: string;
  toAddresses?: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  scheduledAt?: Date;
}

interface UpdateDraftDto {
  toAddresses?: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  scheduledAt?: Date | null;
}

@Injectable()
export class DraftsService {
  constructor(
    @InjectRepository(Draft)
    private readonly draftRepository: Repository<Draft>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
  ) {}

  async findAllByUser(userId: string): Promise<Draft[]> {
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    if (mailboxIds.length === 0) {
      return [];
    }

    return this.draftRepository.find({
      where: { mailboxId: In(mailboxIds), scheduledAt: IsNull() },
      order: { updatedAt: 'DESC' },
    });
  }

  async findScheduledByUser(userId: string): Promise<Draft[]> {
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    if (mailboxIds.length === 0) {
      return [];
    }

    return this.draftRepository.find({
      where: { mailboxId: In(mailboxIds), scheduledAt: Not(IsNull()) },
      order: { scheduledAt: 'ASC' },
    });
  }

  async findById(id: string, userId: string): Promise<Draft> {
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    const draft = await this.draftRepository.findOne({
      where: { id, mailboxId: In(mailboxIds) },
    });

    if (!draft) {
      throw new NotFoundException('Draft not found');
    }

    return draft;
  }

  async create(userId: string, data: CreateDraftDto): Promise<Draft> {
    const mailbox = await this.mailboxRepository.findOne({
      where: { id: data.mailboxId, userId },
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }

    const draft = this.draftRepository.create({
      mailboxId: data.mailboxId,
      threadId: data.threadId || null,
      inReplyTo: data.inReplyTo || null,
      toAddresses: data.toAddresses || [],
      ccAddresses: data.ccAddresses || [],
      bccAddresses: data.bccAddresses || [],
      subject: data.subject || '',
      bodyText: data.bodyText || null,
      bodyHtml: data.bodyHtml || null,
      scheduledAt: data.scheduledAt || null,
    });

    return this.draftRepository.save(draft);
  }

  async update(id: string, userId: string, data: UpdateDraftDto): Promise<Draft> {
    const draft = await this.findById(id, userId);

    if (data.toAddresses !== undefined) draft.toAddresses = data.toAddresses;
    if (data.ccAddresses !== undefined) draft.ccAddresses = data.ccAddresses;
    if (data.bccAddresses !== undefined) draft.bccAddresses = data.bccAddresses;
    if (data.subject !== undefined) draft.subject = data.subject;
    if (data.bodyText !== undefined) draft.bodyText = data.bodyText;
    if (data.bodyHtml !== undefined) draft.bodyHtml = data.bodyHtml;
    if (data.scheduledAt !== undefined) draft.scheduledAt = data.scheduledAt;

    return this.draftRepository.save(draft);
  }

  async delete(id: string, userId: string): Promise<void> {
    const draft = await this.findById(id, userId);
    await this.draftRepository.remove(draft);
  }

  async getDueScheduled(): Promise<Draft[]> {
    return this.draftRepository.find({
      where: {
        scheduledAt: LessThanOrEqual(new Date()),
      },
    });
  }
}
