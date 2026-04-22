import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ImapIdleService } from './services/imap-idle.service';
import { ImapSyncService } from './services/imap-sync.service';
import { Mailbox } from './entities/mailbox.entity';
import { Thread } from './entities/thread.entity';
import { Message } from './entities/message.entity';

// Prevent unhandled rejections from crashing the daemon
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit for known transient errors
  if (error.message?.includes('Connection') || error.message?.includes('IMAP') || error.message?.includes('socket')) {
    console.log('Transient error detected, continuing...');
    return;
  }
  process.exit(1);
});

const BACKGROUND_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes for background folders

async function main() {
  console.log('Starting IMAP Daemon with IDLE support...');

  // Initialize database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'rio',
    password: process.env.DATABASE_PASSWORD || 'rio_secret',
    database: process.env.DATABASE_NAME || 'rio_mailer',
    entities: [Mailbox, Thread, Message],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  });

  await dataSource.initialize();
  console.log('Database connected');

  // Initialize services
  const idleService = new ImapIdleService(dataSource);
  const syncService = new ImapSyncService(dataSource);

  // Start IDLE connections for real-time INBOX updates
  // This uses persistent connections - no polling needed for INBOX
  await idleService.startIdleForAllMailboxes();

  // Background sync for other folders (Sent, Spam, Trash) - these don't need real-time
  const runBackgroundSync = async () => {
    try {
      console.log('Starting background folder sync...');
      await syncService.syncBackgroundFolders();
      console.log('Background folder sync complete');
    } catch (error) {
      console.error('Background sync error:', error);
    }
  };

  // Schedule background sync (every 5 minutes for non-INBOX folders)
  setTimeout(() => {
    runBackgroundSync();
    setInterval(runBackgroundSync, BACKGROUND_POLL_INTERVAL);
  }, 30000); // Start after 30 seconds

  console.log('IMAP Daemon running with:');
  console.log('  - IDLE for INBOX (real-time push notifications)');
  console.log('  - Background sync for Sent/Spam/Trash every 5 minutes');

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await idleService.stopAll();
    await dataSource.destroy();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
