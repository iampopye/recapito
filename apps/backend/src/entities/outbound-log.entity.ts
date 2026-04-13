import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';

export type OutboundStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';

@Entity('outbound_logs')
export class OutboundLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id' })
  messageId: string;

  @OneToOne(() => Message, (message) => message.outboundLog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({ name: 'mailgun_id', type: 'varchar', nullable: true })
  mailgunId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  status: OutboundStatus;

  @Column({ name: 'status_details', type: 'text', nullable: true })
  statusDetails: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
