import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `settings` and `smtp_providers` tables.
 *
 * These two entities existed in the codebase and in `database-schema.sql`, but
 * no migration ever created them -- development worked only because TypeORM's
 * `synchronize` silently built them at boot. With `synchronize` correctly
 * disabled by default, a fresh deploy that follows the README (`pnpm db:migrate`)
 * came up missing both tables: every outbound send failed and the settings page
 * returned a 500.
 *
 * `IF NOT EXISTS` throughout so this is safe to run against an existing database
 * that already has the tables from `synchronize`.
 */
export class AddSettingsAndSmtpProviders1706000000004 implements MigrationInterface {
  name = 'AddSettingsAndSmtpProviders1706000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying NOT NULL,
        "value" text NOT NULL,
        "description" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_settings_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "smtp_providers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'mailgun',
        "from_email" character varying NOT NULL,
        "from_name" character varying,
        "mailgun_api_key" character varying,
        "mailgun_domain" character varying,
        "mailgun_base_url" character varying DEFAULT 'https://api.mailgun.net',
        "brevo_api_key" character varying,
        "smtp_host" character varying,
        "smtp_port" integer,
        "smtp_secure" boolean NOT NULL DEFAULT true,
        "smtp_username" character varying,
        "smtp_password" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_smtp_providers" PRIMARY KEY ("id")
      )
    `);

    // Guarded: on a database where `synchronize` already created these tables,
    // the constraints may exist under TypeORM's generated hash names.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_smtp_providers_user'
        ) THEN
          ALTER TABLE "smtp_providers"
            ADD CONSTRAINT "FK_smtp_providers_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_smtp_providers_user"
        ON "smtp_providers" ("user_id")
    `);

    // mailboxes.smtp_provider_id references this table. The column is created
    // in the initial migration, but the FK could not be added there because
    // smtp_providers did not exist yet.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'mailboxes' AND column_name = 'smtp_provider_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_mailboxes_smtp_provider'
        ) THEN
          ALTER TABLE "mailboxes"
            ADD CONSTRAINT "FK_mailboxes_smtp_provider"
            FOREIGN KEY ("smtp_provider_id") REFERENCES "smtp_providers"("id") ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mailboxes" DROP CONSTRAINT IF EXISTS "FK_mailboxes_smtp_provider"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_smtp_providers_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "smtp_providers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "settings"`);
  }
}
