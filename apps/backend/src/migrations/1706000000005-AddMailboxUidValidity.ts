import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `mailboxes.uid_validity`.
 *
 * The IMAP daemon now catches up by UID ("everything newer than the highest UID
 * I already have") rather than by re-searching a rolling 30-minute date window
 * and re-downloading full message bodies on every reconnect. That change is
 * only safe if we also track UIDVALIDITY: an IMAP server may renumber a folder,
 * after which a stored UID points at a different message. Comparing UIDVALIDITY
 * on connect lets the daemon notice that and fall back to a date-window
 * catch-up instead of silently skipping mail it has never seen.
 *
 * Nullable with no backfill: existing mailboxes have no recorded validity, so
 * they take the date-window path once and record it on that first connect.
 */
export class AddMailboxUidValidity1706000000005 implements MigrationInterface {
  name = 'AddMailboxUidValidity1706000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
        ADD COLUMN IF NOT EXISTS "uid_validity" character varying(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mailboxes" DROP COLUMN IF EXISTS "uid_validity"
    `);
  }
}
