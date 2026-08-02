import { DataSource, Repository } from 'typeorm';
import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser, ParsedMail, AddressObject } from 'mailparser';
import { storeAttachments } from './attachment-store';
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

// Priority folders - sync every poll (fast)
const PRIORITY_FOLDERS = [
  'INBOX',
];

// Background folders - sync less frequently
const BACKGROUND_FOLDERS = [
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

  async syncAllMailboxes(priorityOnly: boolean = true): Promise<void> {
    const mailboxes = await this.mailboxRepository.find({
      where: { isActive: true },
    });

    console.log(`Found ${mailboxes.length} active mailbox(es) to sync`);

    for (const mailbox of mailboxes) {
      try {
        await this.syncMailbox(mailbox, priorityOnly);
      } catch (error) {
        console.error(`Failed to sync mailbox ${mailbox.email}:`, error);
      }
    }
  }

  async syncBackgroundFolders(): Promise<void> {
    const mailboxes = await this.mailboxRepository.find({
      where: { isActive: true },
    });

    for (const mailbox of mailboxes) {
      try {
        await this.syncMailbox(mailbox, false, true);
      } catch (error) {
        console.error(`Failed to sync background folders for ${mailbox.email}:`, error);
      }
    }
  }

  private async syncMailbox(mailbox: Mailbox, priorityOnly: boolean = true, backgroundOnly: boolean = false): Promise<void> {
    console.log(`Syncing mailbox: ${mailbox.email}${backgroundOnly ? ' (background)' : ''}`);

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const client = new ImapFlow({
        host: mailbox.imapHost,
        port: mailbox.imapPort,
        secure: mailbox.imapSsl,
        auth: {
          user: mailbox.imapUsername,
          pass: mailbox.imapPassword,
        },
        logger: {
          debug: (msg: any) => {},
          info: (msg: any) => console.log('[IMAP]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
          warn: (msg: any) => console.warn('[IMAP WARN]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
          error: (msg: any) => console.error('[IMAP ERROR]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
        },
        greetingTimeout: 30000,
        socketTimeout: 60000,
        tls: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        },
      });

      // Handle connection errors gracefully - don't let unhandled events crash the daemon
      client.on('error', (err: Error) => {
        // Only log if not a known transient error during retry
        if (attempt === maxRetries) {
          console.error(`ImapFlow error event for ${mailbox.email}:`, err.message);
        }
      });

      try {
        await client.connect();

      // List available folders
      const folders = await client.list();
      const availableFolders = folders.map(f => f.path);

      if (!backgroundOnly) {
        console.log(`Available folders for ${mailbox.email}:`, availableFolders.slice(0, 10));
      }

      // Determine which folders to sync
      const foldersToSync = backgroundOnly ? BACKGROUND_FOLDERS : (priorityOnly ? PRIORITY_FOLDERS : [...PRIORITY_FOLDERS, ...BACKGROUND_FOLDERS]);

      // Sync each folder that exists
      for (const folderName of foldersToSync) {
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
        // Success - exit retry loop
        return;
      } catch (error: any) {
        lastError = error;
        // Try to close the connection gracefully
        try {
          await client.logout();
        } catch {
          // Ignore logout errors during cleanup
        }

        // Check if we should retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 1s, 2s, 4s... max 10s
          console.log(`IMAP connection attempt ${attempt} failed for ${mailbox.email}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error(`IMAP connection failed for ${mailbox.email} after ${maxRetries} attempts:`, lastError?.message || lastError);
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

      let messageCount = 0;
      const lastUid = mailbox.lastUid || 0;

      // Always search by recent date for realtime sync
      const thirtyMinsAgo = new Date();
      thirtyMinsAgo.setMinutes(thirtyMinsAgo.getMinutes() - 30);
      const searchCriteria = { since: thirtyMinsAgo };

      // Search for messages matching criteria
      const searchResult = await client.search(searchCriteria, { uid: true });
      const uids = searchResult === false ? [] : searchResult;

      if (uids.length === 0) {
        console.log(`No new messages in ${imapFolder}`);
        return;
      }

      console.log(`Found ${uids.length} message(s) to sync in ${imapFolder}`);

      // Fetch in batches of 50 to avoid Gmail limits
      const batchSize = 50;
      let maxUid = lastUid;

      for (let i = 0; i < uids.length; i += batchSize) {
        const batchUids = uids.slice(i, i + batchSize);
        const uidRange = batchUids.join(',');

        try {
          for await (const msg of client.fetch(uidRange, {
            uid: true,
            envelope: true,
            source: true,
          }, { uid: true })) {
            try {
              const wasNew = await this.processMessage(mailbox.id, msg, targetFolder, direction);
              if (wasNew) {
                messageCount++;
              }
              if (msg.uid > maxUid) {
                maxUid = msg.uid;
              }
            } catch (error) {
              console.error(`Failed to process message UID ${msg.uid} in ${imapFolder}:`, error);
            }
          }
        } catch (batchError) {
          console.error(`Failed to fetch batch in ${imapFolder}:`, batchError);
        }
      }

      // Update lastUid in mailbox
      if (maxUid > lastUid) {
        await this.mailboxRepository.update(mailbox.id, { lastUid: maxUid });
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

    // Check if already exists IN THIS MAILBOX.
    //
    // Scoping to mailboxId is essential in a unified inbox: an email addressed
    // to both support@ and sales@ carries one RFC Message-ID but legitimately
    // exists in two mailboxes. A global uniqueness check stored it once and
    // made it silently invisible in whichever mailbox synced second.
    const existing = await this.messageRepository.findOne({
      where: { messageId, mailboxId },
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

    // Persist attachments. `simpleParser` has already decoded them into
    // `parsed.attachments`; until this call existed the daemon read the body
    // and dropped every attached file on the floor.
    if (parsed.attachments?.length) {
      const stored = await storeAttachments(this.dataSource, message.id, parsed.attachments);
      if (stored > 0) {
        console.log(`Stored ${stored} attachment(s) for message ${messageId}`);
      }
    }

    // Update thread - use GREATEST to only update timestamp if new message is newer
    // This ensures new emails always appear on top (Gmail standard behavior)
    await this.threadRepository
      .createQueryBuilder()
      .update(Thread)
      .set({
        lastMessageAt: () => `GREATEST(last_message_at, '${receivedAt.toISOString()}'::timestamp)`,
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
