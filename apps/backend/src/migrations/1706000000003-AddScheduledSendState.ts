import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds send-state tracking to drafts so scheduled email can be delivered
 * exactly once.
 *
 * Before this migration the only scheduling field was `scheduled_at`. A query
 * for "drafts whose scheduled_at has passed" matches the same rows on every
 * run, so any worker built on it would re-send the same message forever.
 * `status` gives each draft a lifecycle, and the partial index below makes the
 * worker's claim query cheap.
 */
export class AddScheduledSendState1706000000003 implements MigrationInterface {
  name = 'AddScheduledSendState1706000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "drafts"
        ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "last_error" text
    `);

    // Backfill: anything already carrying a send time is a scheduled send.
    await queryRunner.query(`
      UPDATE "drafts"
      SET "status" = 'scheduled'
      WHERE "scheduled_at" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "drafts"
        ADD CONSTRAINT "chk_drafts_status"
        CHECK ("status" IN ('draft', 'scheduled', 'sending', 'sent', 'failed'))
    `);

    // Partial index: the worker only ever scans rows that are actually due,
    // so this stays small even with a large drafts table.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_drafts_due"
        ON "drafts" ("scheduled_at")
        WHERE "status" = 'scheduled'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_drafts_due"`);
    await queryRunner.query(
      `ALTER TABLE "drafts" DROP CONSTRAINT IF EXISTS "chk_drafts_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "drafts"
        DROP COLUMN IF EXISTS "last_error",
        DROP COLUMN IF EXISTS "attempts",
        DROP COLUMN IF EXISTS "sent_at",
        DROP COLUMN IF EXISTS "status"
    `);
  }
}
