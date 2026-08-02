import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mailboxes')
export class Mailbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  email: string;

  @Column({ name: 'imap_host' })
  imapHost: string;

  @Column({ name: 'imap_port' })
  imapPort: number;

  @Column({ name: 'imap_ssl', default: true })
  imapSsl: boolean;

  @Column({ name: 'imap_username' })
  imapUsername: string;

  @Column({ name: 'imap_password' })
  imapPassword: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @Column({ name: 'last_uid', type: 'int', default: 0 })
  lastUid: number;

  /**
   * The folder's UIDVALIDITY when `lastUid` was recorded.
   *
   * IMAP servers may renumber a folder, at which point every stored UID refers
   * to a different message. Comparing this on connect is what stops a
   * renumbered mailbox from silently skipping mail it has never seen.
   */
  @Column({ name: 'uid_validity', type: 'varchar', length: 32, nullable: true })
  uidValidity: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
