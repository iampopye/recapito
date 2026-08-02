import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ImapIdleService } from './services/imap-idle.service';
import { ImapSyncService } from './services/imap-sync.service';
import { Mailbox } from './entities/mailbox.entity';
import { Thread } from './entities/thread.entity';
import { Message } from './entities/message.entity';
import { Attachment } from './entities/attachment.entity';

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

/**
 * Read a required environment variable, or stop the daemon with a message that
 * names it. Failing at boot is far easier to diagnose than connecting to the
 * wrong database with a built-in default and syncing nothing.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Missing required environment variable ${name}. ` +
        'Copy .env.example to .env and fill it in before starting the daemon.',
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  console.log('Starting IMAP Daemon with IDLE support...');

  // Initialize database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: requireEnv('DATABASE_USERNAME'),
    // No fallback: a default database password that ships in the source is a
    // credential every deployment shares until someone notices.
    password: requireEnv('DATABASE_PASSWORD'),
    database: requireEnv('DATABASE_NAME'),
    entities: [Mailbox, Thread, Message, Attachment],
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
