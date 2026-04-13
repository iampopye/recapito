import { DataSource, Repository } from 'typeorm';
import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser, ParsedMail, AddressObject } from 'mailparser';
import { Mailbox } from '../entities/mailbox.entity';
import { Thread, ThreadFolder } from '../entities/thread.entity';
import { Message } from '../entities/message.entity';

// Map IMAP folder names to our folder types
const FOLDER_MAPPING: Record<string, ThreadFolder> = {
  'INBOX': 'inbox',
  'Inbox': 'inbox',
  // Gmail folders
  '[Gmail]/Sent Mail': 'sent',
  '[Gmail]/Spam': 'spam',
  '[Gmail]/Trash': 'trash',
  '[Gmail]/All Mail': 'archive',
  // Standard folders
  'Sent': 'sent',
  'Sent Items': 'sent',
  'Sent Messages': 'sent',
  'Spam': 'spam',
  'Junk': 'spam',
  'Junk E-mail': 'spam',
  'Trash': 'trash',
  'Deleted': 'trash',
  'Deleted Items': 'trash',
  'Deleted Messages': 'trash',
  'Archive': 'archive',
  'Archives': 'archive',
};

// Folders to sync (in order of priority)
const FOLDERS_TO_SYNC = [
  'INBOX',
  '[Gmail]/Sent Mail',
  'Sent',
  'Sent Items',
  '[Gmail]/Spam',
  'Spam',
  'Junk',
  '[Gmail]/Trash',
  'Trash',
  'Deleted Items',
];

export class ImapSyncService {
  private mailboxRepository: Repository<Mailbox>;
  private threadRepository: Repository<Thread>;
  private messageRepository: Repository<Message>;

  constructor(private dataSource: DataSource) {
    this.mailboxRepository = dataSource.getRepository(Mailbox);
    this.threadRepository = dataSource.getRepository(Thread);
    this.messageRepository = dataSource.getRepository(Message);
  }

  async syncAllMailboxes(): Promise<void> {
    const mailboxes = await this.mailboxRepository.find({
      where: { isActive: true },
    });

    console.log(`Found ${mailboxes.length} active mailbox(es) to sync`);

    for (const mailbox of mailboxes) {
      try {
        await this.syncMailbox(mailbox);
      } catch (error) {
        console.error(`Failed to sync mailbox ${mailbox.email}:`, error);
      }
    }
  }

  private async syncMailbox(mailbox: Mailbox): Promise<void> {
    console.log(`Syncing mailbox: ${mailbox.email}`);

    const client = new ImapFlow({
      host: mailbox.imapHost,
      port: mailbox.imapPort,
      secure: mailbox.imapSsl,
      auth: {
        user: mailbox.imapUsername,
        pass: mailbox.imapPassword,
      },
      logger: false,
    });

    try {
      await client.connect();

      // List available folders
      const folders = await client.list();
      const availableFolders = folders.map(f => f.path);
      console.log(`Available folders for ${mailbox.email}:`, availableFolders.slice(0, 10));

      // Sync each folder that exists
      for (const folderName of FOLDERS_TO_SYNC) {
        if (availableFolders.includes(folderName)) {
          const targetFolder = FOLDER_MAPPING[folderName] || 'inbox';
          try {
            await this.syncFolder(client, mailbox, folderName, targetFolder);
          } catch (error) {
            console.error(`Failed to sync folder ${folderName}:`, error);
          }
        }
      }

      // Update last sync time
      await this.mailboxRepository.update(mailbox.id, {
        lastSyncAt: new Date(),
      });

      await client.logout();
    } catch (error) {
      console.error(`IMAP connection error for ${mailbox.email}:`, error);
      throw error;
    }
  }

  private async syncFolder(
    client: ImapFlow,
    mailbox: Mailbox,
    imapFolder: string,
    targetFolder: ThreadFolder,
  ): Promise<void> {
    console.log(`Syncing folder ${imapFolder} -> ${targetFolder} for ${mailbox.email}`);

    const lock = await client.getMailboxLock(imapFolder);

    try {
      // For sent folder, we need direction = outbound
      const direction = targetFolder === 'sent' ? 'outbound' : 'inbound';

      // Fetch recent messages (last 30 days or newer)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let messageCount = 0;

      for await (const msg of client.fetch('1:*', {
        uid: true,
        envelope: true,
        source: true,
      })) {
        try {
          const wasNew = await this.processMessage(mailbox.id, msg, targetFolder, direction);
          if (wasNew) {
            messageCount++;
          }
        } catch (error) {
          console.error(`Failed to process message UID ${msg.uid} in ${imapFolder}:`, error);
        }
      }

      console.log(`Synced ${messageCount} new message(s) from ${imapFolder}`);
    } finally {
      lock.release();
    }
  }

  private async processMessage(
    mailboxId: string,
    msg: FetchMessageObject,
    folder: ThreadFolder,
    direction: 'inbound' | 'outbound',
  ): Promise<boolean> {
    // Parse the email
    if (!msg.source) {
      console.error(`No source for message UID ${msg.uid}`);
      return false;
    }
    const parsed = await simpleParser(msg.source);

    const messageId = parsed.messageId || `<generated-${Date.now()}-${msg.uid}@local>`;

    // Check if already exists
    const existing = await this.messageRepository.findOne({
      where: { messageId },
    });
    if (existing) {
      return false;
    }

    // Extract addresses
    const fromAddress = parsed.from?.value[0]?.address || 'unknown@unknown.com';
    const fromName = parsed.from?.value[0]?.name || null;
    const toAddresses = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
      .flatMap((t: AddressObject) => t.value)
      .map((v: { address?: string }) => v.address)
      .filter((a: string | undefined): a is string => !!a);
    const ccAddresses = (parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
      .flatMap((t: AddressObject) => t.value)
      .map((v: { address?: string }) => v.address)
      .filter((a: string | undefined): a is string => !!a);

    const subject = parsed.subject || '(No subject)';
    const receivedAt = parsed.date || new Date();

    // Find or create thread
    const participants = [fromAddress, ...toAddresses, ...ccAddresses].filter(
      (v, i, a) => a.indexOf(v) === i,
    );
    const thread = await this.findOrCreateThread(mailboxId, subject, participants, folder);

    // Create message
    const message = this.messageRepository.create({
      threadId: thread.id,
      mailboxId,
      messageId,
      inReplyTo: parsed.inReplyTo || null,
      direction,
      fromAddress,
      fromName,
      toAddresses,
      ccAddresses,
      subject,
      bodyText: parsed.text || null,
      bodyHtml: parsed.html || null,
      receivedAt,
    });

    await this.messageRepository.save(message);

    // Update thread
    await this.threadRepository
      .createQueryBuilder()
      .update(Thread)
      .set({
        lastMessageAt: receivedAt,
        messageCount: () => 'message_count + 1',
        isRead: folder !== 'inbox', // Mark as read if not inbox
      })
      .where('id = :id', { id: thread.id })
      .execute();

    // Update participants
    const currentThread = await this.threadRepository.findOne({
      where: { id: thread.id },
    });
    if (currentThread) {
      const newParticipants = [...new Set([...currentThread.participants, ...participants])];
      if (newParticipants.length > currentThread.participants.length) {
        await this.threadRepository.update(thread.id, {
          participants: newParticipants,
        });
      }
    }

    return true;
  }

  private async findOrCreateThread(
    mailboxId: string,
    subject: string,
    participants: string[],
    folder: ThreadFolder,
  ): Promise<Thread> {
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

  private normalizeSubject(subject: string): string {
    return subject
      .replace(/^(re:|fwd:|fw:)\s*/gi, '')
      .replace(/^(re:|fwd:|fw:)\s*/gi, '')
      .trim();
  }
}
