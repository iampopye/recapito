import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { Draft } from './draft.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'uuid', nullable: true })
  messageId: string | null;

  @ManyToOne(() => Message, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'message_id' })
  message: Message | null;

  @Column({ name: 'draft_id', type: 'uuid', nullable: true })
  draftId: string | null;

  @ManyToOne(() => Draft, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'draft_id' })
  draft: Draft | null;

  @Column({ type: 'varchar', length: 500 })
  filename: string;

  @Column({ name: 'content_type', type: 'varchar', length: 200 })
  contentType: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ name: 'storage_path', type: 'varchar', length: 1000 })
  storagePath: string;

  @Column({ name: 'content_id', type: 'varchar', length: 500, nullable: true })
  contentId: string | null;

  @Column({ name: 'is_inline', default: false })
  isInline: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
