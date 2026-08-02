import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1706000000000 implements MigrationInterface {
  name = 'InitialSchema1706000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "name" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Mailboxes table
    await queryRunner.query(`
      CREATE TABLE "mailboxes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "imap_host" character varying NOT NULL,
        "imap_port" integer NOT NULL,
        "imap_ssl" boolean NOT NULL DEFAULT true,
        "imap_username" character varying NOT NULL,
        "imap_password" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_sync_at" TIMESTAMP,
        "last_uid" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mailboxes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mailboxes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Threads table
    await queryRunner.query(`
      CREATE TABLE "threads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mailbox_id" uuid NOT NULL,
        "subject" character varying NOT NULL,
        "participants" text[] NOT NULL DEFAULT '{}',
        "last_message_at" TIMESTAMP NOT NULL,
        "message_count" integer NOT NULL DEFAULT 0,
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_threads" PRIMARY KEY ("id"),
        CONSTRAINT "FK_threads_mailbox" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE
      )
    `);

    // Messages table
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "thread_id" uuid NOT NULL,
        "mailbox_id" uuid NOT NULL,
        "message_id" character varying NOT NULL,
        "in_reply_to" character varying,
        "direction" character varying(20) NOT NULL,
        "from_address" character varying NOT NULL,
        "from_name" character varying,
        "to_addresses" text[] NOT NULL,
        "cc_addresses" text[] NOT NULL DEFAULT '{}',
        "subject" character varying NOT NULL,
        "body_text" text,
        "body_html" text,
        "received_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_messages_message_id" UNIQUE ("message_id"),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_mailbox" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE
      )
    `);

    // Outbound logs table
    await queryRunner.query(`
      CREATE TABLE "outbound_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" uuid NOT NULL,
        "mailgun_id" character varying,
        "status" character varying(20) NOT NULL DEFAULT 'queued',
        "status_details" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbound_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_outbound_logs_message" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_mailboxes_user_id" ON "mailboxes" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mailboxes_is_active" ON "mailboxes" ("is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_threads_mailbox_id" ON "threads" ("mailbox_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_threads_last_message_at" ON "threads" ("last_message_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_thread_id" ON "messages" ("thread_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_mailbox_id" ON "messages" ("mailbox_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_received_at" ON "messages" ("received_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_outbound_logs_message_id" ON "outbound_logs" ("message_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_outbound_logs_status" ON "outbound_logs" ("status")`);

    // Enable uuid-ossp extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_outbound_logs_status"`);
    await queryRunner.query(`DROP INDEX "IDX_outbound_logs_message_id"`);
    await queryRunner.query(`DROP INDEX "IDX_messages_received_at"`);
    await queryRunner.query(`DROP INDEX "IDX_messages_mailbox_id"`);
    await queryRunner.query(`DROP INDEX "IDX_messages_thread_id"`);
    await queryRunner.query(`DROP INDEX "IDX_threads_last_message_at"`);
    await queryRunner.query(`DROP INDEX "IDX_threads_mailbox_id"`);
    await queryRunner.query(`DROP INDEX "IDX_mailboxes_is_active"`);
    await queryRunner.query(`DROP INDEX "IDX_mailboxes_user_id"`);
    await queryRunner.query(`DROP TABLE "outbound_logs"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "threads"`);
    await queryRunner.query(`DROP TABLE "mailboxes"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
