import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ImapSyncService } from './services/imap-sync.service';
import { Mailbox } from './entities/mailbox.entity';
import { Thread } from './entities/thread.entity';
import { Message } from './entities/message.entity';

const POLL_INTERVAL = parseInt(process.env.IMAP_POLL_INTERVAL_MS || '60000', 10);

async function main() {
  console.log('Starting IMAP Daemon...');

  // Initialize database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'imark',
    password: process.env.DATABASE_PASSWORD || 'imark_secret',
    database: process.env.DATABASE_NAME || 'imark_mailer',
    entities: [Mailbox, Thread, Message],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  });

  await dataSource.initialize();
  console.log('Database connected');

  const syncService = new ImapSyncService(dataSource);

  // Run sync loop
  const runSync = async () => {
    try {
      await syncService.syncAllMailboxes();
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  // Initial sync
  await runSync();

  // Schedule periodic sync
  setInterval(runSync, POLL_INTERVAL);

  console.log(`IMAP Daemon running. Polling every ${POLL_INTERVAL / 1000}s`);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await dataSource.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await dataSource.destroy();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
