import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs } from 'fs';
import type { ReadStream } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Stores attachment bytes on disk.
 *
 * Filenames arriving over email are attacker-controlled. They routinely contain
 * `../`, absolute paths, NUL bytes, and Windows device names. Nothing supplied
 * by the sender is ever used to build a path here: the on-disk name is a random
 * UUID, and the original filename is kept only as a database column, used for
 * the Content-Disposition header on download.
 */
@Injectable()
export class AttachmentStorageService {
  private readonly logger = new Logger(AttachmentStorageService.name);
  private readonly root: string;
  private readonly maxBytes: number;

  constructor(private readonly configService: ConfigService) {
    this.root = path.resolve(
      this.configService.get<string>('ATTACHMENTS_PATH', '/var/lib/recapito/attachments'),
    );
    this.maxBytes =
      Number(this.configService.get<string>('ATTACHMENT_MAX_BYTES', '26214400')) || 26214400;
  }

  get maxAttachmentBytes(): number {
    return this.maxBytes;
  }

  /**
   * Write bytes to disk and return the storage path, relative to the root.
   *
   * Relative is deliberate: storing an absolute path would break every existing
   * row the moment the volume is mounted somewhere else.
   */
  async store(content: Buffer, originalFilename: string): Promise<string> {
    if (content.length > this.maxBytes) {
      throw new BadRequestException(
        `Attachment is ${content.length} bytes, over the ${this.maxBytes} byte limit`,
      );
    }

    // Keep only an extension, and only if it looks like one. Everything else
    // about the sender-supplied name is discarded for path purposes.
    const ext = this.safeExtension(originalFilename);

    const now = new Date();
    const shard = path.join(
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
    );
    const relPath = path.join(shard, `${crypto.randomUUID()}${ext}`);
    const absPath = this.resolveWithinRoot(relPath);

    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, { mode: 0o640 });

    return relPath;
  }

  async createReadStream(relPath: string): Promise<ReadStream> {
    const absPath = this.resolveWithinRoot(relPath);
    await fs.access(absPath);
    return createReadStream(absPath);
  }

  async delete(relPath: string): Promise<void> {
    try {
      await fs.unlink(this.resolveWithinRoot(relPath));
    } catch (error) {
      // A missing file is not worth failing a delete over.
      this.logger.warn(
        `Could not remove attachment ${relPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Resolve a stored path and prove it stays inside the storage root.
   *
   * Even though `store()` only ever generates safe paths, this is checked again
   * on every read: the value has made a round trip through the database, and a
   * SQL-injection or a bad migration elsewhere should not become arbitrary file
   * read.
   */
  private resolveWithinRoot(relPath: string): string {
    if (relPath.includes('\0')) {
      throw new BadRequestException('Invalid attachment path');
    }
    const absPath = path.resolve(this.root, relPath);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (absPath !== this.root && !absPath.startsWith(rootWithSep)) {
      throw new BadRequestException('Invalid attachment path');
    }
    return absPath;
  }

  private safeExtension(filename: string): string {
    const ext = path.extname(filename || '').toLowerCase();
    // Bounded length, and no characters that could be meaningful to a path.
    if (!ext || ext.length > 12 || !/^\.[a-z0-9]+$/.test(ext)) {
      return '';
    }
    return ext;
  }
}
