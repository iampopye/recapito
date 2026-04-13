import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { Thread, ThreadFolder } from '../../entities/thread.entity';
import { Mailbox } from '../../entities/mailbox.entity';
import { Message } from '../../entities/message.entity';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@imark/shared';

interface FindThreadsOptions {
  page?: number;
  pageSize?: number;
  mailboxId?: string;
  folder?: ThreadFolder;
  search?: string;
}

export interface FolderCounts {
  inbox: number;
  sent: number;
  spam: number;
  trash: number;
  archive: number;
  drafts: number;
  snoozed: number;
  unread: number;
}

@Injectable()
export class ThreadsService {
  constructor(
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async findAllByUser(userId: string, options: FindThreadsOptions = {}) {
    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const skip = (page - 1) * pageSize;

    // Get user's mailbox IDs
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    if (mailboxIds.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    // Build query
    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .where('thread.mailbox_id IN (:...mailboxIds)', { mailboxIds });

    // Filter by specific mailbox
    if (options.mailboxId && mailboxIds.includes(options.mailboxId)) {
      queryBuilder.andWhere('thread.mailbox_id = :mailboxId', { mailboxId: options.mailboxId });
    }

    // Filter by folder
    if (options.folder) {
      queryBuilder.andWhere('thread.folder = :folder', { folder: options.folder });
    }

    // Search in subject and participants
    if (options.search) {
      queryBuilder.andWhere(
        '(thread.subject ILIKE :search OR EXISTS (SELECT 1 FROM unnest(thread.participants) AS p WHERE p ILIKE :search))',
        { search: `%${options.search}%` },
      );
    }

    // Order and paginate
    queryBuilder
      .orderBy('thread.last_message_at', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getFolderCounts(userId: string, mailboxId?: string): Promise<FolderCounts> {
    // Get user's mailbox IDs
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    if (mailboxIds.length === 0) {
      return { inbox: 0, sent: 0, spam: 0, trash: 0, archive: 0, drafts: 0, snoozed: 0, unread: 0 };
    }

    const targetMailboxIds = mailboxId && mailboxIds.includes(mailboxId)
      ? [mailboxId]
      : mailboxIds;

    const counts = await this.threadRepository
      .createQueryBuilder('thread')
      .select('thread.folder', 'folder')
      .addSelect('COUNT(*)', 'count')
      .where('thread.mailbox_id IN (:...mailboxIds)', { mailboxIds: targetMailboxIds })
      .groupBy('thread.folder')
      .getRawMany();

    const unreadCount = await this.threadRepository
      .createQueryBuilder('thread')
      .where('thread.mailbox_id IN (:...mailboxIds)', { mailboxIds: targetMailboxIds })
      .andWhere('thread.is_read = false')
      .andWhere('thread.folder = :folder', { folder: 'inbox' })
      .getCount();

    const result: FolderCounts = { inbox: 0, sent: 0, spam: 0, trash: 0, archive: 0, drafts: 0, snoozed: 0, unread: unreadCount };
    for (const row of counts) {
      if (row.folder in result) {
        result[row.folder as keyof Omit<FolderCounts, 'unread'>] = parseInt(row.count, 10);
      }
    }

    return result;
  }

  async findById(id: string, userId: string): Promise<Thread> {
    // Verify user owns the mailbox
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    const thread = await this.threadRepository.findOne({
      where: { id, mailboxId: In(mailboxIds) },
      relations: ['messages'],
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // Sort messages by date
    thread.messages.sort(
      (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
    );

    return thread;
  }

  async findOrCreateBySubject(
    mailboxId: string,
    subject: string,
    participants: string[],
    folder: ThreadFolder = 'inbox',
  ): Promise<Thread> {
    // Normalize subject (remove Re:, Fwd:, etc.)
    const normalizedSubject = this.normalizeSubject(subject);

    let thread = await this.threadRepository.findOne({
      where: { mailboxId, subject: normalizedSubject },
    });

    if (!thread) {
      thread = this.threadRepository.create({
        mailboxId,
        subject: normalizedSubject,
        participants,
        lastMessageAt: new Date(),
        messageCount: 0,
        folder,
      });
      thread = await this.threadRepository.save(thread);
    }

    return thread;
  }

  async updateThreadStats(threadId: string, lastMessageAt: Date): Promise<void> {
    await this.threadRepository
      .createQueryBuilder()
      .update(Thread)
      .set({
        lastMessageAt,
        messageCount: () => 'message_count + 1',
      })
      .where('id = :id', { id: threadId })
      .execute();
  }

  async addParticipant(threadId: string, email: string): Promise<void> {
    const thread = await this.threadRepository.findOne({ where: { id: threadId } });
    if (thread && !thread.participants.includes(email)) {
      thread.participants.push(email);
      await this.threadRepository.save(thread);
    }
  }

  async markAsRead(id: string, userId: string): Promise<Thread> {
    const thread = await this.findById(id, userId);
    thread.isRead = true;
    return this.threadRepository.save(thread);
  }

  async moveToFolder(id: string, userId: string, folder: ThreadFolder): Promise<Thread> {
    const thread = await this.findById(id, userId);
    thread.folder = folder;
    return this.threadRepository.save(thread);
  }

  async toggleStar(id: string, userId: string): Promise<Thread> {
    const thread = await this.findById(id, userId);
    thread.isStarred = !thread.isStarred;
    return this.threadRepository.save(thread);
  }

  async searchMessages(userId: string, query: string, options: FindThreadsOptions = {}) {
    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const skip = (page - 1) * pageSize;

    // Get user's mailbox IDs
    const mailboxes = await this.mailboxRepository.find({
      where: { userId },
      select: ['id'],
    });
    const mailboxIds = mailboxes.map((m) => m.id);

    if (mailboxIds.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    // Search in messages
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.thread', 'thread')
      .where('message.mailbox_id IN (:...mailboxIds)', { mailboxIds })
      .andWhere(
        '(message.subject ILIKE :query OR message.from_address ILIKE :query OR message.body_text ILIKE :query)',
        { query: `%${query}%` },
      );

    if (options.mailboxId && mailboxIds.includes(options.mailboxId)) {
      queryBuilder.andWhere('message.mailbox_id = :mailboxId', { mailboxId: options.mailboxId });
    }

    queryBuilder
      .orderBy('message.received_at', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private normalizeSubject(subject: string): string {
    return subject
      .replace(/^(re:|fwd:|fw:)\s*/gi, '')
      .replace(/^(re:|fwd:|fw:)\s*/gi, '')
      .trim();
  }
}
