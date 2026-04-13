import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { MailgunService } from './mailgun.service';
import { SendEmailDto } from './dto/send-email.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';
import { MailboxesService } from '../mailboxes/mailboxes.service';

@Controller('mail')
export class MailgunController {
  constructor(
    private readonly mailgunService: MailgunService,
    private readonly mailboxesService: MailboxesService,
  ) {}

  @Post('send/:mailboxId')
  @UseGuards(JwtAuthGuard)
  async sendEmail(
    @CurrentUser() user: User,
    @Param('mailboxId') mailboxId: string,
    @Body() dto: SendEmailDto,
  ) {
    // Verify user owns the mailbox
    await this.mailboxesService.findById(mailboxId, user.id);
    return this.mailgunService.sendEmail(mailboxId, dto);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async sendTestEmail(
    @CurrentUser() user: User,
    @Body() body: { to: string },
  ) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.mailgunService.sendTestEmail(body.to);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: Record<string, unknown>) {
    await this.mailgunService.handleWebhook(payload);
    return { success: true };
  }
}
