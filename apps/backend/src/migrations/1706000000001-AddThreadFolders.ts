import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThreadFolders1706000000001 implements MigrationInterface {
  name = 'AddThreadFolders1706000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add folder column with default 'inbox'
    await queryRunner.query(`
      ALTER TABLE "threads"
      ADD COLUMN IF NOT EXISTS "folder" varchar(20) NOT NULL DEFAULT 'inbox'
    `);

    // Add is_starred column with default false
    await queryRunner.query(`
      ALTER TABLE "threads"
      ADD COLUMN IF NOT EXISTS "is_starred" boolean NOT NULL DEFAULT false
    `);

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_threads_mailbox_folder"
      ON "threads" ("mailbox_id", "folder")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_threads_mailbox_subject"
      ON "threads" ("mailbox_id", "subject")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_threads_mailbox_subject"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_threads_mailbox_folder"`);
    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN IF EXISTS "is_starred"`);
    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN IF EXISTS "folder"`);
  }
}
