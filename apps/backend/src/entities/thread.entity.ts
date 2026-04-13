import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { Mailbox } from './mailbox.entity';
import { Message } from './message.entity';
import { Label } from './label.entity';

export type ThreadFolder = 'inbox' | 'sent' | 'spam' | 'trash' | 'archive' | 'drafts' | 'snoozed';
export type ThreadPriority = 'low' | 'normal' | 'high';

@Entity('threads')
@Index(['mailboxId', 'folder'])
@Index(['mailboxId', 'subject'])
export class Thread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mailbox_id' })
  mailboxId: string;

  @ManyToOne(() => Mailbox, (mailbox) => mailbox.threads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mailbox_id' })
  mailbox: Mailbox;

  @Column()
  subject: string;

  @Column('text', { array: true, default: '{}' })
  participants: string[];

  @Column({ name: 'last_message_at', type: 'timestamp' })
  lastMessageAt: Date;

  @Column({ name: 'message_count', default: 0 })
  messageCount: number;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'is_starred', default: false })
  isStarred: boolean;

  @Column({ type: 'varchar', length: 20, default: 'inbox' })
  folder: ThreadFolder;

  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority: ThreadPriority;

  @Column({ name: 'snoozed_until', type: 'timestamp', nullable: true })
  snoozedUntil: Date | null;

  @OneToMany(() => Message, (message) => message.thread)
  messages: Message[];

  @ManyToMany(() => Label, (label) => label.threads)
  @JoinTable({
    name: 'thread_labels',
    joinColumn: { name: 'thread_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'label_id', referencedColumnName: 'id' },
  })
  labels: Label[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
