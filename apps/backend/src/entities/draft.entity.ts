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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
