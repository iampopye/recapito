import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Draft } from '../../entities/draft.entity';
import { MailgunService } from '../mailgun/mailgun.service';

/** Give up after this many failed attempts and mark the draft `failed`. */
const MAX_ATTEMPTS = 3;

/** Most drafts to claim in a single tick, so one big backlog can't stall the loop. */
const BATCH_SIZE = 25;

/**
 * Delivers drafts whose scheduled send time has arrived.
 *
 * Previously `DraftsService.getDueScheduled()` existed but was never called by
 * anything, so scheduling an email silently did nothing — it was accepted,
 * stored, and never sent. This worker is what actually delivers them.
 */
@Injectable()
export class ScheduledSendService {
  private readonly logger = new Logger(ScheduledSendService.name);

  /** Guards against a slow tick overlapping the next one within a single process. */
  private running = false;

  constructor(
    @InjectRepository(Draft)
    private readonly draftRepository: Repository<Draft>,
    private readonly dataSource: DataSource,
    private readonly mailgunService: MailgunService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueDrafts(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous scheduled-send tick still running; skipping this one.');
      return;
    }
    this.running = true;

    try {
      const claimed = await this.claimDueDrafts(BATCH_SIZE);
      if (claimed.length === 0) {
        return;
      }

      this.logger.log(`Sending ${claimed.length} scheduled draft(s).`);
      for (const draft of claimed) {
        await this.sendOne(draft);
      }
    } catch (error) {
      // Never let a scheduler tick throw — an unhandled rejection here would
      // take down the cron for the life of the process.
      this.logger.error(
        `Scheduled-send tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Atomically move due drafts to `sending` and return them.
   *
   * `FOR UPDATE SKIP LOCKED` is what makes this safe to run on more than one
   * backend replica: each row can only be claimed by one worker, and workers
   * step over rows their peers already hold instead of blocking on them.
   * Without this, two replicas would both send the same email.
   */
  private async claimDueDrafts(limit: number): Promise<Draft[]> {
    const rows = await this.dataSource.query(
      `
      UPDATE drafts
      SET status = 'sending', attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM drafts
        WHERE status = 'scheduled'
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= now()
        ORDER BY scheduled_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
      `,
      [limit],
    );

    const ids = (rows as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) {
      return [];
    }

    return this.draftRepository.findByIds(ids);
  }

  private async sendOne(draft: Draft): Promise<void> {
    try {
      if (!draft.toAddresses || draft.toAddresses.length === 0) {
        throw new Error('Draft has no recipients');
      }

      await this.mailgunService.sendEmail(draft.mailboxId, {
        to: draft.toAddresses,
        cc: draft.ccAddresses?.length ? draft.ccAddresses : undefined,
        subject: draft.subject,
        bodyText: draft.bodyText ?? undefined,
        bodyHtml: draft.bodyHtml ?? undefined,
        threadId: draft.threadId ?? undefined,
      });

      await this.draftRepository.update(draft.id, {
        status: 'sent',
        sentAt: new Date(),
        lastError: null,
      });
      this.logger.log(`Sent scheduled draft ${draft.id}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Retry until MAX_ATTEMPTS, then stop and surface the reason. Going back
      // to 'scheduled' is what makes the next tick pick it up again.
      const giveUp = draft.attempts >= MAX_ATTEMPTS;
      await this.draftRepository.update(draft.id, {
        status: giveUp ? 'failed' : 'scheduled',
        lastError: message,
      });

      if (giveUp) {
        this.logger.error(
          `Draft ${draft.id} failed permanently after ${draft.attempts} attempt(s): ${message}`,
        );
      } else {
        this.logger.warn(
          `Draft ${draft.id} send failed (attempt ${draft.attempts}/${MAX_ATTEMPTS}), will retry: ${message}`,
        );
      }
    }
  }

  /**
   * Recover drafts stuck in `sending` because the process died mid-send.
   * Runs on a slower cadence than the main loop; the age cutoff avoids
   * clawing back a send that is legitimately still in flight.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async requeueStuckDrafts(): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `
        UPDATE drafts
        SET status = CASE WHEN attempts >= $1 THEN 'failed' ELSE 'scheduled' END,
            last_error = 'Worker stopped mid-send; requeued'
        WHERE status = 'sending'
          AND updated_at < now() - interval '15 minutes'
        RETURNING id
        `,
        [MAX_ATTEMPTS],
      );
      const count = (result as unknown[]).length;
      if (count > 0) {
        this.logger.warn(`Requeued ${count} draft(s) stuck in 'sending'.`);
      }
    } catch (error) {
      this.logger.error(
        `Stuck-draft sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
