import { DataSource, Repository } from 'typeorm';
import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser, AddressObject } from 'mailparser';
import { Mailbox } from '../entities/mailbox.entity';
import { Thread, ThreadFolder } from '../entities/thread.entity';
import { Message } from '../entities/message.entity';

/**
 * IMAP IDLE Service - Uses persistent connections with IDLE for real-time email notifications
 * This is how Gmail/Outlook work - push notifications instead of polling
 */
export class ImapIdleService {
  private mailboxRepository: Repository<Mailbox>;
  private threadRepository: Repository<Thread>;
  private messageRepository: Repository<Message>;
  private activeConnections: Map<string, ImapFlow> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(private dataSource: DataSource) {
    this.mailboxRepository = dataSource.getRepository(Mailbox);
    this.threadRepository = dataSource.getRepository(Thread);
    this.messageRepository = dataSource.getRepository(Message);
  }

  /**
   * Start IDLE connections for all active mailboxes
   */
  async startIdleForAllMailboxes(): Promise<void> {
    const mailboxes = await this.mailboxRepository.find({
      where: { isActive: true },
    });

    console.log(`Starting IDLE connections for ${mailboxes.length} mailbox(es)`);

    for (const mailbox of mailboxes) {
      await this.startIdleForMailbox(mailbox);
    }
  }

  /**
   * Start IDLE connection for a single mailbox
   */
  private async startIdleForMailbox(mailbox: Mailbox): Promise<void> {
    // Don't create duplicate connections
    if (this.activeConnections.has(mailbox.id)) {
      console.log(`IDLE connection already exists for ${mailbox.email}`);
      return;
    }

    console.log(`Starting IDLE connection for ${mailbox.email}`);

    const client = new ImapFlow({
      host: mailbox.imapHost,
      port: mailbox.imapPort,
      secure: mailbox.imapSsl,
      auth: {
        user: mailbox.imapUsername,
        pass: mailbox.imapPassword,
      },
      logger: false,
      greetingTimeout: 30000,
      socketTimeout: 300000, // 5 minutes - longer timeout for IDLE
    });

    // Handle errors
    client.on('error', (err: Error) => {
      console.error(`IMAP error for ${mailbox.email}:`, err.message);
      this.handleDisconnect(mailbox);
    });

    // Handle close
    client.on('close', () => {
      console.log(`IMAP connection closed for ${mailbox.email}`);
      this.handleDisconnect(mailbox);
    });

    try {
      await client.connect();
      console.log(`Connected to IMAP for ${mailbox.email}`);

      // Store the connection
      this.activeConnections.set(mailbox.id, client);

      // Select INBOX and start IDLE
      await this.idleOnFolder(client, mailbox, 'INBOX');

    } catch (error: any) {
      console.error(`Failed to connect IMAP for ${mailbox.email}:`, error.message);
      this.scheduleReconnect(mailbox);
    }
  }

  /**
   * IDLE on a folder and listen for new messages
   */
  private async idleOnFolder(client: ImapFlow, mailbox: Mailbox, folder: string): Promise<void> {
    try {
      // Select the folder
      const lock = await client.getMailboxLock(folder);

      try {
        // Listen for new messages
        client.on('exists', async (data: { path: string; count: number; prevCount: number }) => {
          if (data.count > data.prevCount) {
            const newCount = data.count - data.prevCount;
            console.log(`📬 ${newCount} new message(s) in ${mailbox.email}/${data.path}`);

            // Fetch only the new messages
            await this.fetchNewMessages(client, mailbox, data.prevCount + 1, data.count);
          }
        });

        console.log(`IDLE started for ${mailbox.email}/${folder}`);

        // Do initial sync of recent messages
        await this.fetchRecentMessages(client, mailbox);

        // Start IDLE - this will keep the connection open and wait for notifications
        // The exists event will fire when new mail arrives
        while (client.usable) {
          try {
            await client.idle();
          } catch (idleError: any) {
            if (idleError.message?.includes('timeout')) {
              // IDLE timeout is normal - just restart IDLE
              continue;
            }
            throw idleError;
          }
        }

      } finally {
        lock.release();
      }

    } catch (error: any) {
      console.error(`IDLE error for ${mailbox.email}:`, error.message);
      this.handleDisconnect(mailbox);
    }
  }

  /**
   * Fetch recent messages (last 30 minutes) for initial sync
   */
  private async fetchRecentMessages(client: ImapFlow, mailbox: Mailbox): Promise<void> {
    try {
      const thirtyMinsAgo = new Date();
      thirtyMinsAgo.setMinutes(thirtyMinsAgo.getMinutes() - 30);

      const searchResult = await client.search({ since: thirtyMinsAgo }, { uid: true });
      const uids = searchResult === false ? [] : searchResult;

      if (uids.length === 0) {
        console.log(`No recent messages for ${mailbox.email}`);
        return;
      }

      console.log(`Fetching ${uids.length} recent message(s) for ${mailbox.email}`);

      // Fetch in batches
      const batchSize = 50;
      for (let i = 0; i < uids.length; i += batchSize) {
        const batchUids = uids.slice(i, i + batchSize);
        const uidRange = batchUids.join(',');

        for await (const msg of client.fetch(uidRange, {
          uid: true,
          envelope: true,
          source: true,
        }, { uid: true })) {
          await this.processMessage(mailbox.id, msg, 'inbox', 'inbound');
        }
      }

      console.log(`Initial sync complete for ${mailbox.email}`);
    } catch (error: any) {
      console.error(`Fetch recent messages error for ${mailbox.email}:`, error.message);
    }
  }

  /**
   * Fetch new messages by sequence numbers
   */
  private async fetchNewMessages(
    client: ImapFlow,
    mailbox: Mailbox,
    startSeq: number,
    endSeq: number,
  ): Promise<void> {
    try {
      const range = `${startSeq}:${endSeq}`;
      let newCount = 0;

      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        const isNew = await this.processMessage(mailbox.id, msg, 'inbox', 'inbound');
        if (isNew) newCount++;
      }

      if (newCount > 0) {
        console.log(`✅ Synced ${newCount} new message(s) for ${mailbox.email}`);
      }
    } catch (error: any) {
      console.error(`Fetch new messages error for ${mailbox.email}:`, error.message);
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    mailboxId: string,
    msg: FetchMessageObject,
    folder: ThreadFolder,
    direction: 'inbound' | 'outbound',
  ): Promise<boolean> {
    if (!msg.source) {
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

    // Update thread - use GREATEST to only update timestamp if new message is newer
    // This ensures new emails always appear on top (Gmail standard behavior)
    await this.threadRepository
      .createQueryBuilder()
      .update(Thread)
      .set({
        lastMessageAt: () => `GREATEST(last_message_at, '${receivedAt.toISOString()}'::timestamp)`,
        messageCount: () => 'message_count + 1',
        isRead: false, // New message = unread
      })
      .where('id = :id', { id: thread.id })
      .execute();

    return true;
  }

  /**
   * Find or create thread by subject
   */
  private async findOrCreateThread(
    mailboxId: string,
    subject: string,
    participants: string[],
    folder: ThreadFolder,
  ): Promise<Thread> {
    const normalizedSubject = subject
      .replace(/^(re:|fwd:|fw:)\s*/gi, '')
      .replace(/^(re:|fwd:|fw:)\s*/gi, '')
      .trim();

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

  /**
   * Handle disconnection - schedule reconnect
   */
  private handleDisconnect(mailbox: Mailbox): void {
    // Remove from active connections
    const client = this.activeConnections.get(mailbox.id);
    if (client) {
      try {
        client.close();
      } catch {
        // Ignore close errors
      }
      this.activeConnections.delete(mailbox.id);
    }

    // Schedule reconnect
    this.scheduleReconnect(mailbox);
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(mailbox: Mailbox): void {
    // Clear existing timeout
    const existingTimeout = this.reconnectTimeouts.get(mailbox.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Reconnect after 30 seconds
    const timeout = setTimeout(async () => {
      this.reconnectTimeouts.delete(mailbox.id);
      console.log(`Reconnecting IDLE for ${mailbox.email}...`);

      // Refresh mailbox data from DB (password might have changed)
      const freshMailbox = await this.mailboxRepository.findOne({
        where: { id: mailbox.id, isActive: true },
      });

      if (freshMailbox) {
        await this.startIdleForMailbox(freshMailbox);
      }
    }, 30000);

    this.reconnectTimeouts.set(mailbox.id, timeout);
    console.log(`Scheduled reconnect for ${mailbox.email} in 30 seconds`);
  }

  /**
   * Stop all IDLE connections
   */
  async stopAll(): Promise<void> {
    console.log('Stopping all IDLE connections...');

    // Clear all reconnect timeouts
    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.reconnectTimeouts.clear();

    // Close all connections
    for (const [mailboxId, client] of this.activeConnections) {
      try {
        await client.logout();
      } catch {
        // Ignore logout errors
      }
    }
    this.activeConnections.clear();

    console.log('All IDLE connections stopped');
  }
}
