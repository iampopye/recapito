import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Mailbox } from './mailbox.entity';

/**
 * Lifecycle of a draft.
 *
 * `draft`     - being composed, no send time set
 * `scheduled` - has a send time in the future, waiting for the worker
 * `sending`   - claimed by a worker, send in progress (guards against
 *               two replicas sending the same draft twice)
 * `sent`      - delivered to the outbound provider
 * `failed`    - all retries exhausted; `lastError` explains why
 */
export type DraftStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

@Entity('drafts')
export class Draft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mailbox_id', type: 'uuid' })
  mailboxId: string;

  @ManyToOne(() => Mailbox, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mailbox_id' })
  mailbox: Mailbox;

  @Column({ name: 'thread_id', type: 'uuid', nullable: true })
  threadId: string | null;

  @Column({ name: 'in_reply_to', type: 'varchar', length: 500, nullable: true })
  inReplyTo: string | null;

  @Column('text', { array: true, default: '{}' })
  toAddresses: string[];

  @Column('text', { array: true, default: '{}' })
  ccAddresses: string[];

  @Column('text', { array: true, default: '{}' })
  bccAddresses: string[];

  @Column({ default: '' })
  subject: string;

  @Column({ name: 'body_text', type: 'text', nullable: true })
  bodyText: string | null;

  @Column({ name: 'body_html', type: 'text', nullable: true })
  bodyHtml: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  // Without a status column, "find drafts whose scheduled_at has passed"
  // matches the same rows on every tick forever, so a scheduled email would
  // be re-sent on a loop. Status is what makes the send happen exactly once.
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: DraftStatus;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
