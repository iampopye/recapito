import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
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
      where: { mailboxId: In(mailboxIds), status: 'draft' },
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

    // Includes 'sending' and 'failed' so the user can see a send that is in
    // flight or one that gave up, rather than it vanishing from the list.
    return this.draftRepository.find({
      where: {
        mailboxId: In(mailboxIds),
        status: In(['scheduled', 'sending', 'failed']),
      },
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
      // A send time is what promotes a draft into the worker's queue.
      status: data.scheduledAt ? 'scheduled' : 'draft',
    });

    return this.draftRepository.save(draft);
  }

  async update(id: string, userId: string, data: UpdateDraftDto): Promise<Draft> {
    const draft = await this.findById(id, userId);

    // Editing a message that has already gone out would be misleading -- the
    // recipient has the original. Block it rather than silently diverging.
    if (draft.status === 'sent') {
      throw new ConflictException('This draft has already been sent and can no longer be edited');
    }
    if (draft.status === 'sending') {
      throw new ConflictException('This draft is currently being sent; try again in a moment');
    }

    if (data.toAddresses !== undefined) draft.toAddresses = data.toAddresses;
    if (data.ccAddresses !== undefined) draft.ccAddresses = data.ccAddresses;
    if (data.bccAddresses !== undefined) draft.bccAddresses = data.bccAddresses;
    if (data.subject !== undefined) draft.subject = data.subject;
    if (data.bodyText !== undefined) draft.bodyText = data.bodyText;
    if (data.bodyHtml !== undefined) draft.bodyHtml = data.bodyHtml;
    if (data.scheduledAt !== undefined) {
      draft.scheduledAt = data.scheduledAt;
      // Setting a time queues it; clearing the time (or unscheduling a failed
      // send) puts it back to a plain draft and resets the retry counter.
      draft.status = data.scheduledAt ? 'scheduled' : 'draft';
      draft.attempts = 0;
      draft.lastError = null;
    }

    return this.draftRepository.save(draft);
  }

  async delete(id: string, userId: string): Promise<void> {
    const draft = await this.findById(id, userId);
    await this.draftRepository.remove(draft);
  }

  /**
   * Drafts whose send time has arrived and that are still waiting.
   *
   * The `status` filter is essential: without it this matches every past-due
   * draft on every call, including ones already delivered.
   *
   * Note the worker in `ScheduledSendService` does not use this method -- it
   * claims rows with `FOR UPDATE SKIP LOCKED` so two replicas cannot grab the
   * same draft. This is kept for diagnostics and tests.
   */
  async getDueScheduled(): Promise<Draft[]> {
    return this.draftRepository.find({
      where: {
        status: 'scheduled',
        scheduledAt: LessThanOrEqual(new Date()),
      },
      order: { scheduledAt: 'ASC' },
    });
  }
}
