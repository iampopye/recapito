import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type MessageDirection = 'inbound' | 'outbound';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'thread_id' })
  threadId: string;

  @Column({ name: 'mailbox_id' })
  mailboxId: string;

  @Column({ name: 'message_id', unique: true })
  messageId: string;

  @Column({ name: 'in_reply_to', type: 'varchar', nullable: true })
  inReplyTo: string | null;

  @Column({ type: 'varchar', length: 20 })
  direction: MessageDirection;

  @Column({ name: 'from_address' })
  fromAddress: string;

  @Column({ name: 'from_name', type: 'varchar', nullable: true })
  fromName: string | null;

  @Column('text', { name: 'to_addresses', array: true })
  toAddresses: string[];

  @Column('text', { name: 'cc_addresses', array: true, default: '{}' })
  ccAddresses: string[];

  @Column()
  subject: string;

  @Column({ name: 'body_text', type: 'text', nullable: true })
  bodyText: string | null;

  @Column({ name: 'body_html', type: 'text', nullable: true })
  bodyHtml: string | null;

  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
