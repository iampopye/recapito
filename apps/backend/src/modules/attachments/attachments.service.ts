import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ReadStream } from 'fs';
import { Attachment } from '../../entities/attachment.entity';
import { Message } from '../../entities/message.entity';
import { Mailbox } from '../../entities/mailbox.entity';
import { AttachmentStorageService } from './attachment-storage.service';

export interface AttachmentMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId: string | null;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
    private readonly storage: AttachmentStorageService,
  ) {}

  /**
   * Attachments on a message the user owns.
   *
   * Ownership runs message -> mailbox -> user. Skipping that chain would let
   * anyone read any attachment by guessing a message id.
   */
  async findByMessage(messageId: string, userId: string): Promise<AttachmentMetadata[]> {
    await this.assertOwnsMessage(messageId, userId);

    const attachments = await this.attachmentRepository.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });

    return attachments.map((a) => this.toMetadata(a));
  }

  /**
   * Resolve an attachment for download, verifying ownership first.
   * Returns the row plus an open read stream.
   */
  async openForDownload(
    attachmentId: string,
    userId: string,
  ): Promise<{ attachment: Attachment; stream: ReadStream }> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.messageId) {
      await this.assertOwnsMessage(attachment.messageId, userId);
    } else if (attachment.draftId) {
      await this.assertOwnsDraft(attachment.draftId, userId);
    } else {
      // Orphan row with no parent -- refuse rather than guess.
      throw new NotFoundException('Attachment not found');
    }

    let stream: ReadStream;
    try {
      stream = await this.storage.createReadStream(attachment.storagePath);
    } catch {
      // Row exists but the file is gone (volume not mounted, manual cleanup).
      // A 404 is more honest than a 500 here.
      throw new NotFoundException('Attachment file is no longer available');
    }

    return { attachment, stream };
  }

  async deleteForDraft(draftId: string): Promise<void> {
    const attachments = await this.attachmentRepository.find({ where: { draftId } });
    for (const attachment of attachments) {
      await this.storage.delete(attachment.storagePath);
    }
    if (attachments.length > 0) {
      await this.attachmentRepository.remove(attachments);
    }
  }

  private toMetadata(a: Attachment): AttachmentMetadata {
    // storagePath is deliberately not exposed -- it is an internal detail and
    // leaking the layout invites probing.
    return {
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      isInline: a.isInline,
      contentId: a.contentId,
    };
  }

  private async assertOwnsMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      select: ['id', 'mailboxId'],
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const mailbox = await this.mailboxRepository.findOne({
      where: { id: message.mailboxId, userId },
      select: ['id'],
    });
    if (!mailbox) {
      // Deliberately "not found" rather than "forbidden": telling a caller that
      // a message exists but belongs to someone else is itself a disclosure.
      throw new NotFoundException('Message not found');
    }
  }

  private async assertOwnsDraft(draftId: string, userId: string): Promise<void> {
    const rows = await this.attachmentRepository.query(
      `SELECT m.id
         FROM drafts d
         JOIN mailboxes m ON m.id = d.mailbox_id
        WHERE d.id = $1 AND m.user_id = $2
        LIMIT 1`,
      [draftId, userId],
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }
  }
}
