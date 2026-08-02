import { DataSource, Repository } from 'typeorm';
import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser, AddressObject } from 'mailparser';
import { storeAttachments } from './attachment-store';
import { normalizeSubject, isMeaningfulSubject } from './subject';
import { Mailbox } from '../entities/mailbox.entity';
import { Thread, ThreadFolder } from '../entities/thread.entity';
import { Message } from '../entities/message.entity';

/**
 * IMAP IDLE Service - Uses persistent connections with IDLE for real-time email notifications
 * This is how Gmail/Outlook work - push notifications instead of polling
 */
/** Reconnect backoff. Starts here and doubles per attempt. */
const BASE_RECONNECT_DELAY_MS = 30_000;

/** Ceiling on the backoff, so a long outage retries every 15 minutes, not hourly. */
const MAX_RECONNECT_DELAY_MS = 15 * 60_000;

/** Random spread added to every delay so mailboxes do not reconnect in lockstep. */
const JITTER_MS = 10_000;

/** Stop retrying after this many consecutive failures. */
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * How far back to reach on a mailbox's very first sync, or after the server
 * renumbers a folder. Bounded so connecting a decade-old mailbox does not try
 * to download the whole thing in one pass. Override with INITIAL_SYNC_DAYS.
 */
const INITIAL_SYNC_DAYS = Number(process.env.INITIAL_SYNC_DAYS || '7') || 7;

export class ImapIdleService {
  private mailboxRepository: Repository<Mailbox>;
  private threadRepository: Repository<Thread>;
  private messageRepository: Repository<Message>;
  private activeConnections: Map<string, ImapFlow> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  /** Consecutive failed reconnects per mailbox; cleared on a successful connect. */
  private reconnectAttempts: Map<string, number> = new Map();

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

    // Handle errors -- pass the error through so a rejected credential is not
    // treated as a transient network fault and retried into a lockout.
    client.on('error', (err: Error) => {
      console.error(`IMAP error for ${mailbox.email}:`, err.message);
      this.handleDisconnect(mailbox, err);
    });

    // Handle close
    client.on('close', () => {
      console.log(`IMAP connection closed for ${mailbox.email}`);
      this.handleDisconnect(mailbox);
    });

    try {
      await client.connect();
      console.log(`Connected to IMAP for ${mailbox.email}`);

      // A successful connect clears the backoff, so a mailbox that recovers
      // after a long outage starts from the short delay again.
      this.reconnectAttempts.delete(mailbox.id);

      // Store the connection
      this.activeConnections.set(mailbox.id, client);

      // Select INBOX and start IDLE
      await this.idleOnFolder(client, mailbox, 'INBOX');

    } catch (error: any) {
      console.error(`Failed to connect IMAP for ${mailbox.email}:`, error.message);
      if (this.isAuthFailure(error)) {
        console.error(
          `Authentication REJECTED for ${mailbox.email}. Not retrying -- repeated failed ` +
            'logins can get the account blocked. Update the mailbox password to resume.',
        );
        this.reconnectAttempts.delete(mailbox.id);
        await this.markMailboxNeedsAttention(mailbox, 'authentication failed');
        return;
      }
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
   * Catch up on messages that arrived while this mailbox was disconnected.
   *
   * This runs on every (re)connect, which is why it must be cheap. It used to
   * search a rolling 30-minute date window and fetch each hit with
   * `source: true` -- the entire RFC822 message including attachments. A
   * connection that flapped therefore re-downloaded the same mail on every
   * retry, which counts against provider bandwidth quotas (Gmail's is 2,500 MB
   * per day, and exceeding it suspends the account for hours).
   *
   * Fetching by UID instead means each message is transferred exactly once:
   * IMAP UIDs are monotonically increasing per folder, so "everything newer
   * than the highest UID we have stored" is precise and cheap. It also removes
   * the 30-minute blind spot -- a longer outage no longer loses mail.
   */
  private async fetchRecentMessages(client: ImapFlow, mailbox: Mailbox): Promise<void> {
    try {
      // UIDVALIDITY changes mean the server has renumbered the folder and every
      // stored UID is meaningless. Falling back to a date window is the only
      // safe option here.
      const status = await client.status('INBOX', { uidValidity: true, uidNext: true });
      const storedValidity = mailbox.uidValidity ? String(mailbox.uidValidity) : null;
      const currentValidity = status.uidValidity ? String(status.uidValidity) : null;
      const uidsAreValid = storedValidity !== null && storedValidity === currentValidity;

      let uids: number[];

      if (uidsAreValid && mailbox.lastUid > 0) {
        // Everything strictly newer than what we already have.
        const searchResult = await client.search(
          { uid: `${mailbox.lastUid + 1}:*` },
          { uid: true },
        );
        uids = searchResult === false ? [] : searchResult.filter((u) => u > mailbox.lastUid);
      } else {
        // First connect, or the folder was renumbered. Bounded catch-up so a
        // ten-year mailbox does not try to download itself in one go.
        const since = new Date();
        since.setDate(since.getDate() - INITIAL_SYNC_DAYS);
        const searchResult = await client.search({ since }, { uid: true });
        uids = searchResult === false ? [] : searchResult;
        if (!uidsAreValid && storedValidity !== null) {
          console.warn(
            `UIDVALIDITY changed for ${mailbox.email} (${storedValidity} -> ${currentValidity}); ` +
              'falling back to a date-window catch-up.',
          );
        }
      }

      if (uids.length === 0) {
        console.log(`No new messages for ${mailbox.email}`);
        await this.rememberSyncPoint(mailbox, mailbox.lastUid, currentValidity);
        return;
      }

      console.log(`Fetching ${uids.length} new message(s) for ${mailbox.email}`);

      let highestUid = mailbox.lastUid;
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
          if (typeof msg.uid === 'number' && msg.uid > highestUid) {
            highestUid = msg.uid;
          }
        }

        // Persist progress per batch. If the daemon dies mid-catch-up, the next
        // run resumes rather than starting over.
        await this.rememberSyncPoint(mailbox, highestUid, currentValidity);
      }

      console.log(`Catch-up complete for ${mailbox.email} (highest UID ${highestUid})`);
    } catch (error: any) {
      console.error(`Fetch recent messages error for ${mailbox.email}:`, error.message);
    }
  }

  /**
   * Record how far this mailbox has been synced, so the next connect can fetch
   * only what is genuinely new.
   */
  private async rememberSyncPoint(
    mailbox: Mailbox,
    lastUid: number,
    uidValidity: string | null,
  ): Promise<void> {
    try {
      const patch: Record<string, unknown> = { lastSyncAt: new Date() };
      if (lastUid > 0 && lastUid !== mailbox.lastUid) {
        patch.lastUid = lastUid;
        mailbox.lastUid = lastUid;
      }
      if (uidValidity && String(mailbox.uidValidity ?? '') !== uidValidity) {
        patch.uidValidity = uidValidity;
        mailbox.uidValidity = uidValidity;
      }
      await this.mailboxRepository.update(mailbox.id, patch);
    } catch (error) {
      console.error(
        `Could not persist sync point for ${mailbox.email}:`,
        error instanceof Error ? error.message : error,
      );
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
    const thread = await this.findOrCreateThread(
      mailboxId,
      subject,
      participants,
      folder,
      parsed.inReplyTo || null,
    );

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

    // Persist attachments on the IDLE path too. Both ingest paths must store
    // them, or whether a file survives would depend on which sync mechanism
    // happened to pick the message up.
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
    inReplyTo?: string | null,
  ): Promise<Thread> {
    // 1. Follow In-Reply-To. This is the header the RFC defines for exactly
    //    this purpose and it is authoritative: it identifies the parent
    //    message directly, regardless of what the subject says. It was being
    //    stored on every message and never read.
    if (inReplyTo) {
      const parent = await this.messageRepository.findOne({
        where: { messageId: inReplyTo, mailboxId },
        select: ['id', 'threadId'],
      });
      if (parent?.threadId) {
        const parentThread = await this.threadRepository.findOne({
          where: { id: parent.threadId },
        });
        if (parentThread) {
          return parentThread;
        }
      }
    }

    const normalizedSubject = normalizeSubject(subject);

    // 2. Fall back to subject matching -- but only for a subject that actually
    //    identifies something. Matching on an empty or "(No subject)" subject
    //    collapsed every unrelated subject-less email in the mailbox into one
    //    enormous thread.
    if (isMeaningfulSubject(normalizedSubject)) {
      const existing = await this.threadRepository.findOne({
        where: { mailboxId, subject: normalizedSubject },
      });
      if (existing) {
        return existing;
      }
    }

    // 3. Nothing matched, or the subject is not usable for matching.
    const thread = this.threadRepository.create({
      mailboxId,
      subject: normalizedSubject || '(No subject)',
      participants,
      lastMessageAt: new Date(),
      messageCount: 0,
      folder,
    });
    return this.threadRepository.save(thread);
  }

  /**
   * Handle disconnection - schedule reconnect
   */
  private handleDisconnect(mailbox: Mailbox, error?: unknown): void {
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

    // A rejected credential is permanent until a human fixes it. Retrying it
    // on a timer is how an account gets locked out: at the old fixed 30s
    // interval a mailbox with a revoked password produced 2,880 failed
    // authentications every day, forever.
    if (this.isAuthFailure(error)) {
      console.error(
        `Authentication REJECTED for ${mailbox.email}. Not retrying -- repeated failed logins ` +
          'can get the account blocked by the provider. Update the mailbox password to resume.',
      );
      this.reconnectAttempts.delete(mailbox.id);
      void this.markMailboxNeedsAttention(mailbox, 'authentication failed');
      return;
    }

    // Schedule reconnect
    this.scheduleReconnect(mailbox);
  }

  /**
   * Distinguish "the credential is wrong" from "the network hiccuped".
   * Only the second is worth retrying.
   */
  private isAuthFailure(error: unknown): boolean {
    if (!error) return false;
    const err = error as { authenticationFailed?: boolean; responseText?: string; message?: string };
    if (err.authenticationFailed === true) return true;
    const text = `${err.responseText ?? ''} ${err.message ?? ''}`.toUpperCase();
    return (
      text.includes('AUTHENTICATIONFAILED') ||
      text.includes('INVALID CREDENTIALS') ||
      text.includes('LOGIN FAILED') ||
      text.includes('AUTHENTICATE FAILED')
    );
  }

  /**
   * Deactivate a mailbox that cannot authenticate, so the daemon stops touching
   * it and the user can see why in the UI.
   */
  private async markMailboxNeedsAttention(mailbox: Mailbox, reason: string): Promise<void> {
    try {
      await this.mailboxRepository.update(mailbox.id, { isActive: false });
      console.warn(`Deactivated mailbox ${mailbox.email} (${reason}). Re-enable it after fixing the credential.`);
    } catch (error) {
      console.error(
        `Could not deactivate ${mailbox.email}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff and jitter.
   *
   * The previous version retried every 30 seconds forever. Several mailboxes
   * flapping at once is enough to trip provider connection-rate limits
   * (Fastmail blocks around 1,000 connections/hour), and each reconnect also
   * re-ran a full message fetch -- so a flapping connection re-downloaded the
   * same mail thousands of times a day against Gmail's daily bandwidth cap,
   * whose penalty is a temporary account suspension.
   */
  private scheduleReconnect(mailbox: Mailbox): void {
    // Clear existing timeout
    const existingTimeout = this.reconnectTimeouts.get(mailbox.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const attempt = (this.reconnectAttempts.get(mailbox.id) ?? 0) + 1;
    this.reconnectAttempts.set(mailbox.id, attempt);

    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `Giving up on ${mailbox.email} after ${MAX_RECONNECT_ATTEMPTS} failed reconnects. ` +
          'Restart the daemon or re-save the mailbox once the cause is fixed.',
      );
      this.reconnectAttempts.delete(mailbox.id);
      return;
    }

    // Exponential backoff, capped, plus jitter so that mailboxes knocked
    // offline together do not all reconnect on the same tick.
    const backoff = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** (attempt - 1),
      MAX_RECONNECT_DELAY_MS,
    );
    const delay = backoff + Math.floor(Math.random() * JITTER_MS);

    console.log(
      `Reconnect for ${mailbox.email} scheduled in ${Math.round(delay / 1000)}s ` +
        `(attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`,
    );

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
    }, delay);

    this.reconnectTimeouts.set(mailbox.id, timeout);
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
