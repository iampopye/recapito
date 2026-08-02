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
import { encryptedColumn } from '../common/crypto/encrypted-column.transformer';

export type SmtpProviderType = 'mailgun' | 'brevo' | 'smtp';

@Entity('smtp_providers')
export class SmtpProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', default: 'mailgun' })
  type: SmtpProviderType;

  // Email address to send from
  @Column({ name: 'from_email', type: 'varchar', length: 255 })
  fromEmail: string;

  @Column({ name: 'from_name', type: 'varchar', nullable: true })
  fromName: string | null;

  // Mailgun-specific settings.
  // API keys are encrypted at rest -- a Mailgun private key can send mail as
  // the domain and read delivery logs, so it is as sensitive as a password.
  @Column({
    name: 'mailgun_api_key',
    type: 'varchar',
    length: 1024,
    nullable: true,
    transformer: encryptedColumn,
  })
  mailgunApiKey: string | null;

  @Column({ name: 'mailgun_domain', type: 'varchar', nullable: true })
  mailgunDomain: string | null;

  @Column({ name: 'mailgun_base_url', type: 'varchar', nullable: true, default: 'https://api.mailgun.net' })
  mailgunBaseUrl: string | null;

  // Brevo-specific settings
  @Column({
    name: 'brevo_api_key',
    type: 'varchar',
    length: 1024,
    nullable: true,
    transformer: encryptedColumn,
  })
  brevoApiKey: string | null;

  // Custom SMTP settings
  @Column({ name: 'smtp_host', type: 'varchar', nullable: true })
  smtpHost: string | null;

  @Column({ name: 'smtp_port', type: 'int', nullable: true })
  smtpPort: number | null;

  @Column({ name: 'smtp_secure', type: 'boolean', default: true })
  smtpSecure: boolean;

  @Column({ name: 'smtp_username', type: 'varchar', nullable: true })
  smtpUsername: string | null;

  @Column({
    name: 'smtp_password',
    type: 'varchar',
    length: 1024,
    nullable: true,
    transformer: encryptedColumn,
  })
  smtpPassword: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
