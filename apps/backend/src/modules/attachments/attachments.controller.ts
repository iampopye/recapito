import { Controller, Get, Param, ParseUUIDPipe, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';
import { AttachmentsService, AttachmentMetadata } from './attachments.service';

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get('message/:messageId')
  async listForMessage(
    @CurrentUser() user: User,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<AttachmentMetadata[]> {
    return this.attachmentsService.findByMessage(messageId, user.id);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { attachment, stream } = await this.attachmentsService.openForDownload(id, user.id);

    // Serve every attachment as an opaque download.
    //
    // An email attachment is untrusted content from an arbitrary sender. If a
    // .html or .svg attachment were rendered inline, it would execute on this
    // application's origin with the user's session -- stored XSS delivered by
    // email. `application/octet-stream` plus `attachment` disposition and
    // `nosniff` means the browser saves it instead of running it.
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Length', String(attachment.size));
    res.setHeader('Content-Disposition', this.contentDisposition(attachment.filename));

    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500);
      }
      res.end();
    });

    stream.pipe(res);
  }

  /**
   * Build a Content-Disposition value that survives non-ASCII filenames without
   * allowing header injection.
   *
   * The plain `filename=` parameter cannot carry UTF-8, so it gets an ASCII
   * fallback, and `filename*` carries the real name per RFC 5987. Quotes,
   * backslashes and any CR/LF are stripped from the fallback -- a filename
   * containing a newline would otherwise let a sender inject arbitrary
   * response headers.
   */
  private contentDisposition(filename: string): string {
    const cleaned = (filename || 'attachment').replace(/[\r\n]/g, '');
    const asciiFallback =
      cleaned
        .replace(/[^\x20-\x7E]/g, '_')
        .replace(/["\\]/g, '_')
        .slice(0, 200) || 'attachment';
    const encoded = encodeURIComponent(cleaned).slice(0, 400);
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
  }
}
