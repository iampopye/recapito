import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Daemon-side view of the `attachments` table.
 *
 * The daemon deliberately keeps its own slim entity definitions rather than
 * importing the API's, so the two services can be deployed independently.
 * Relations are omitted here because the daemon only ever inserts rows.
 */
@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'uuid', nullable: true })
  messageId: string | null;

  @Column({ name: 'draft_id', type: 'uuid', nullable: true })
  draftId: string | null;

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
