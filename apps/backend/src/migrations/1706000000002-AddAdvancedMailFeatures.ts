import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdvancedMailFeatures1706000000002 implements MigrationInterface {
  name = 'AddAdvancedMailFeatures1706000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add priority and snoozed_until to threads
    await queryRunner.query(`
      ALTER TABLE "threads"
      ADD COLUMN IF NOT EXISTS "priority" varchar(10) NOT NULL DEFAULT 'normal',
      ADD COLUMN IF NOT EXISTS "snoozed_until" timestamp
    `);

    // Create labels table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "labels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(100) NOT NULL,
        "color" varchar(20) NOT NULL DEFAULT '#3B82F6',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create thread_labels junction table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "thread_labels" (
        "thread_id" uuid NOT NULL REFERENCES "threads"("id") ON DELETE CASCADE,
        "label_id" uuid NOT NULL REFERENCES "labels"("id") ON DELETE CASCADE,
        PRIMARY KEY ("thread_id", "label_id")
      )
    `);

    // Create drafts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "drafts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "mailbox_id" uuid NOT NULL REFERENCES "mailboxes"("id") ON DELETE CASCADE,
        "thread_id" uuid REFERENCES "threads"("id") ON DELETE SET NULL,
        "in_reply_to" varchar(500),
        "to_addresses" text[] NOT NULL DEFAULT '{}',
        "cc_addresses" text[] NOT NULL DEFAULT '{}',
        "bcc_addresses" text[] NOT NULL DEFAULT '{}',
        "subject" varchar(500) NOT NULL DEFAULT '',
        "body_text" text,
        "body_html" text,
        "scheduled_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create attachments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "message_id" uuid REFERENCES "messages"("id") ON DELETE CASCADE,
        "draft_id" uuid REFERENCES "drafts"("id") ON DELETE CASCADE,
        "filename" varchar(500) NOT NULL,
        "content_type" varchar(200) NOT NULL,
        "size" integer NOT NULL,
        "storage_path" varchar(1000) NOT NULL,
        "content_id" varchar(500),
        "is_inline" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create signatures table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "signatures" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(100) NOT NULL,
        "content" text NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create contacts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "email" varchar(255) NOT NULL,
        "name" varchar(255),
        "company" varchar(255),
        "phone" varchar(50),
        "notes" text,
        "avatar_url" varchar(500),
        "is_favorite" boolean NOT NULL DEFAULT false,
        "last_contacted_at" timestamp,
        "contact_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("user_id", "email")
      )
    `);

    // Create templates table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(100) NOT NULL,
        "subject" varchar(500),
        "body_text" text,
        "body_html" text,
        "shortcut" varchar(50) NOT NULL DEFAULT '',
        "use_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_labels_user" ON "labels" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_drafts_mailbox" ON "drafts" ("mailbox_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_drafts_scheduled" ON "drafts" ("scheduled_at") WHERE scheduled_at IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_attachments_message" ON "attachments" ("message_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_attachments_draft" ON "attachments" ("draft_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_contacts_user" ON "contacts" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_contacts_email" ON "contacts" ("user_id", "email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_templates_user" ON "templates" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_threads_snoozed" ON "threads" ("snoozed_until") WHERE snoozed_until IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_threads_snoozed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contacts_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contacts_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attachments_draft"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attachments_message"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drafts_scheduled"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drafts_mailbox"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_labels_user"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contacts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "signatures"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drafts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "thread_labels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "labels"`);

    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN IF EXISTS "snoozed_until"`);
    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN IF EXISTS "priority"`);
  }
}
