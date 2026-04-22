import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Thread } from './thread.entity';
import { Message } from './message.entity';
import { SmtpProvider } from './smtp-provider.entity';

@Entity('mailboxes')
export class Mailbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.mailboxes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'imap_host', type: 'varchar', length: 255 })
  imapHost: string;

  @Column({ name: 'imap_port', type: 'int' })
  imapPort: number;

  @Column({ name: 'imap_ssl', default: true })
  imapSsl: boolean;

  @Column({ name: 'imap_username', type: 'varchar', length: 255 })
  imapUsername: string;

  @Column({ name: 'imap_password', type: 'varchar', length: 500 })
  imapPassword: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'smtp_provider_id', type: 'uuid', nullable: true })
  smtpProviderId: string | null;

  @ManyToOne(() => SmtpProvider, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'smtp_provider_id' })
  smtpProvider: SmtpProvider | null;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @Column({ name: 'last_uid', type: 'int', default: 0 })
  lastUid: number;

  @OneToMany(() => Thread, (thread) => thread.mailbox)
  threads: Thread[];

  @OneToMany(() => Message, (message) => message.mailbox)
  messages: Message[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
