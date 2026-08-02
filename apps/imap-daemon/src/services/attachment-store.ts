import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Attachment as ParsedAttachment } from 'mailparser';
import type { DataSource } from 'typeorm';
import { Attachment } from '../entities/attachment.entity';

const ROOT = path.resolve(
  process.env.ATTACHMENTS_PATH || '/var/lib/recapito/attachments',
);

const MAX_BYTES = Number(process.env.ATTACHMENT_MAX_BYTES || '26214400') || 26214400;

/**
 * Persist the attachments parsed out of an email.
 *
 * `mailparser` already decodes attachments into `parsed.attachments`; before
 * this existed the daemon simply ignored that array, so every attachment a
 * user received was silently discarded on sync.
 *
 * Nothing the sender controls is used to build a filesystem path. The on-disk
 * name is a random UUID; the sender's filename is stored only as a database
 * column and is re-attached as a header at download time.
 */
export async function storeAttachments(
  dataSource: DataSource,
  messageId: string,
  attachments: ParsedAttachment[] | undefined,
): Promise<number> {
  if (!attachments || attachments.length === 0) {
    return 0;
  }

  const repo = dataSource.getRepository(Attachment);
  let stored = 0;

  for (const att of attachments) {
    try {
      const content = att.content as Buffer | undefined;
      if (!content || !Buffer.isBuffer(content)) {
        continue;
      }

      if (content.length > MAX_BYTES) {
        console.warn(
          `Skipping attachment "${att.filename ?? 'unnamed'}" on message ${messageId}: ` +
            `${content.length} bytes exceeds ATTACHMENT_MAX_BYTES (${MAX_BYTES}).`,
        );
        continue;
      }

      const originalName = sanitiseDisplayName(att.filename);
      const relPath = await writeToDisk(content, originalName);

      const row = repo.create({
        messageId,
        draftId: null,
        filename: originalName,
        // Never trust the declared content type for rendering decisions -- the
        // download endpoint serves everything as octet-stream regardless. This
        // is retained for display (icon choice) only.
        contentType: (att.contentType || 'application/octet-stream').slice(0, 200),
        size: content.length,
        storagePath: relPath,
        contentId: att.cid ? String(att.cid).slice(0, 500) : null,
        // `related` disposition means the part is referenced from the HTML body
        // (an inline image) rather than being a user-facing file.
        isInline: att.contentDisposition === 'inline' || Boolean(att.related),
      });

      await repo.save(row);
      stored += 1;
    } catch (error) {
      // One bad attachment must not abort the whole message sync -- the message
      // body is more valuable than any single part.
      console.error(
        `Failed to store attachment on message ${messageId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return stored;
}

async function writeToDisk(content: Buffer, originalName: string): Promise<string> {
  const ext = safeExtension(originalName);
  const now = new Date();
  const shard = path.join(
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
  );
  const relPath = path.join(shard, `${crypto.randomUUID()}${ext}`);
  const absPath = path.resolve(ROOT, relPath);

  // Defence in depth: the path is generated, not derived from input, but prove
  // it anyway so a future change here cannot become an arbitrary write.
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (!absPath.startsWith(rootWithSep)) {
    throw new Error('Refusing to write attachment outside the storage root');
  }

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, { mode: 0o640 });
  return relPath;
}

/** Keep a human-readable name for display, stripped of anything path-like. */
function sanitiseDisplayName(filename: string | undefined): string {
  const base = path.basename(filename || '').replace(/[\r\n\0]/g, '');
  return base.slice(0, 500) || 'attachment';
}

function safeExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (!ext || ext.length > 12 || !/^\.[a-z0-9]+$/.test(ext)) {
    return '';
  }
  return ext;
}
