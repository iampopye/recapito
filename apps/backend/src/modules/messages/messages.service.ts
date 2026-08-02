import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageDirection } from '../../entities/message.entity';
import { ThreadsService } from '../threads/threads.service';

export interface CreateMessageData {
  mailboxId: string;
  messageId: string;
  inReplyTo?: string | null;
  direction: MessageDirection;
  fromAddress: string;
  fromName?: string | null;
  toAddresses: string[];
  ccAddresses?: string[];
  subject: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  receivedAt: Date;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly threadsService: ThreadsService,
  ) {}

  async create(data: CreateMessageData): Promise<Message> {
    // Check if message already exists (by messageId)
    const existing = await this.messageRepository.findOne({
      where: { messageId: data.messageId },
    });
    if (existing) {
      return existing;
    }

    // Collect all participants
    const participants = [
      data.fromAddress,
      ...data.toAddresses,
      ...(data.ccAddresses || []),
    ].filter((v, i, a) => a.indexOf(v) === i); // unique

    // Find or create thread
    const thread = await this.threadsService.findOrCreateBySubject(
      data.mailboxId,
      data.subject,
      participants,
    );

    // Create message
    const message = this.messageRepository.create({
      ...data,
      threadId: thread.id,
      ccAddresses: data.ccAddresses || [],
    });
    const savedMessage = await this.messageRepository.save(message);

    // Update thread stats
    await this.threadsService.updateThreadStats(thread.id, data.receivedAt);

    // Add any new participants
    for (const email of participants) {
      await this.threadsService.addParticipant(thread.id, email);
    }

    return savedMessage;
  }

  async findById(id: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: ['thread'],
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }

  async findByThreadId(threadId: string): Promise<Message[]> {
    return this.messageRepository.find({
      where: { threadId },
      order: { receivedAt: 'ASC' },
    });
  }

  async findByMessageId(messageId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { messageId },
    });
  }
}
