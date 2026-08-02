import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ThreadFolder = 'inbox' | 'sent' | 'spam' | 'trash' | 'archive';

@Entity('threads')
export class Thread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mailbox_id' })
  mailboxId: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
