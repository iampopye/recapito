import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Thread } from './thread.entity';
import { Mailbox } from './mailbox.entity';
import { OutboundLog } from './outbound-log.entity';

export type MessageDirection = 'inbound' | 'outbound';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'thread_id', type: 'uuid' })
  threadId: string;

  @ManyToOne(() => Thread, (thread) => thread.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread: Thread;

  @Column({ name: 'mailbox_id', type: 'uuid' })
  mailboxId: string;

  @ManyToOne(() => Mailbox, (mailbox) => mailbox.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mailbox_id' })
  mailbox: Mailbox;

  @Column({ name: 'message_id', type: 'varchar', length: 500, unique: true })
  messageId: string; // Email Message-ID header

  @Column({ name: 'in_reply_to', type: 'varchar', nullable: true })
  inReplyTo: string | null;

  @Column({ type: 'varchar', length: 20 })
  direction: MessageDirection;

  @Column({ name: 'from_address', type: 'varchar', length: 500 })
  fromAddress: string;

  @Column({ name: 'from_name', type: 'varchar', nullable: true })
  fromName: string | null;

  @Column('text', { name: 'to_addresses', array: true })
  toAddresses: string[];

  @Column('text', { name: 'cc_addresses', array: true, default: '{}' })
  ccAddresses: string[];

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ name: 'body_text', type: 'text', nullable: true })
  bodyText: string | null;

  @Column({ name: 'body_html', type: 'text', nullable: true })
  bodyHtml: string | null;

  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @OneToOne(() => OutboundLog, (log) => log.message)
  outboundLog: OutboundLog;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
