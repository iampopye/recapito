import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Readable } from 'stream';
import FormData from 'form-data';
import { Message } from '../../entities/message.entity';
import { Mailbox } from '../../entities/mailbox.entity';
import { OutboundLog, OutboundStatus } from '../../entities/outbound-log.entity';
import { ThreadsService } from '../threads/threads.service';
import { SettingsService, MailgunSettings } from '../settings/settings.service';
import { MailboxesService } from '../mailboxes/mailboxes.service';
import { SmtpProvidersService } from '../smtp-providers/smtp-providers.service';
import { SendEmailDto } from './dto/send-email.dto';

interface MailgunResponse {
  id: string;
  message: string;
}

@Injectable()
export class MailgunService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(OutboundLog)
    private readonly outboundLogRepository: Repository<OutboundLog>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
    private readonly threadsService: ThreadsService,
    private readonly settingsService: SettingsService,
    private readonly smtpProvidersService: SmtpProvidersService,
  ) {}

  private async getSettings(): Promise<MailgunSettings> {
    return this.settingsService.getMailgunSettings();
  }

  async sendEmail(mailboxId: string, dto: SendEmailDto): Promise<Message> {
    // Get mailbox with SMTP provider
    const mailbox = await this.mailboxRepository.findOne({
      where: { id: mailboxId },
      relations: ['smtpProvider'],
    });

    if (!mailbox) {
      throw new BadRequestException('Mailbox not found');
    }

    // Determine SMTP settings - use mailbox's provider or fall back to global settings
    const smtpProvider = mailbox.smtpProvider;
    let fromEmail: string;
    let fromName: string;
    let domain: string;

    if (smtpProvider) {
      fromEmail = smtpProvider.fromEmail;
      fromName = smtpProvider.fromName || smtpProvider.fromEmail.split('@')[0];
      domain = smtpProvider.mailgunDomain || smtpProvider.fromEmail.split('@')[1];
    } else {
      const settings = await this.getSettings();
      fromEmail = settings.fromEmail;
      fromName = settings.fromName;
      domain = settings.domain;
    }

    // Generate a unique Message-ID
    const messageId = `<${crypto.randomUUID()}@${domain}>`;

    // Determine thread
    let threadId = dto.threadId;
    let inReplyTo: string | null = null;

    if (threadId) {
      // Get the last message in the thread for In-Reply-To header
      const messages = await this.messageRepository.find({
        where: { threadId },
        order: { receivedAt: 'DESC' },
        take: 1,
      });
      if (messages.length > 0) {
        inReplyTo = messages[0].messageId;
      }
    } else {
      // Create new thread for outbound email
      const participants = [fromEmail, ...dto.to, ...(dto.cc || [])];
      const thread = await this.threadsService.findOrCreateBySubject(
        mailboxId,
        dto.subject,
        participants,
        'sent', // New outbound emails go to sent folder
      );
      threadId = thread.id;
    }

    // Create message record first
    const message = this.messageRepository.create({
      threadId,
      mailboxId,
      messageId,
      inReplyTo,
      direction: 'outbound',
      fromAddress: fromEmail,
      fromName: fromName,
      toAddresses: dto.to,
      ccAddresses: dto.cc || [],
      subject: dto.subject,
      bodyText: dto.bodyText || null,
      bodyHtml: dto.bodyHtml || null,
      receivedAt: new Date(),
    });
    const savedMessage = await this.messageRepository.save(message);

    // Create outbound log
    const outboundLog = this.outboundLogRepository.create({
      messageId: savedMessage.id,
      status: 'queued',
    });
    await this.outboundLogRepository.save(outboundLog);

    // Update thread stats
    await this.threadsService.updateThreadStats(threadId, new Date());

    // Send via SMTP provider or fall back to legacy Mailgun
    try {
      let sendResult: { id: string };

      if (smtpProvider) {
        // Use the SMTP provider service
        sendResult = await this.smtpProvidersService.sendEmail(smtpProvider, {
          from: `${fromName} <${fromEmail}>`,
          to: dto.to,
          cc: dto.cc,
          subject: dto.subject,
          text: dto.bodyText,
          html: dto.bodyHtml,
          messageId,
          inReplyTo,
        });
      } else {
        // Fall back to legacy Mailgun settings
        const settings = await this.getSettings();
        const mailgunResponse = await this.sendViaMailgun(settings, {
          from: `${fromName} <${fromEmail}>`,
          to: dto.to,
          cc: dto.cc,
          subject: dto.subject,
          text: dto.bodyText,
          html: dto.bodyHtml,
          messageId,
          inReplyTo,
        });
        sendResult = mailgunResponse;
      }

      // Update outbound log with message ID
      await this.outboundLogRepository.update(outboundLog.id, {
        mailgunId: sendResult.id,
        status: 'sent',
      });
    } catch (error) {
      // Update status to failed
      await this.outboundLogRepository.update(outboundLog.id, {
        status: 'failed',
        statusDetails: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    return savedMessage;
  }

  private async sendViaMailgun(
    settings: MailgunSettings,
    params: {
      from: string;
      to: string[];
      cc?: string[];
      subject: string;
      text?: string;
      html?: string;
      messageId: string;
      inReplyTo?: string | null;
    },
  ): Promise<MailgunResponse> {
    const formData = new URLSearchParams();
    formData.append('from', params.from);
    params.to.forEach((to) => formData.append('to', to));
    if (params.cc) {
      params.cc.forEach((cc) => formData.append('cc', cc));
    }
    formData.append('subject', params.subject);
    if (params.text) formData.append('text', params.text);
    if (params.html) formData.append('html', params.html);
    formData.append('h:Message-ID', params.messageId);
    if (params.inReplyTo) {
      formData.append('h:In-Reply-To', params.inReplyTo);
      formData.append('h:References', params.inReplyTo);
    }

    const url = `${settings.baseUrl}/v3/${settings.domain}/messages`;
    const auth = Buffer.from(`api:${settings.apiKey}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<MailgunResponse>;
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    const settings = await this.getSettings();

    // This endpoint is unauthenticated by design -- Mailgun calls it -- so the
    // signature IS the authentication. It must be mandatory.
    //
    // The previous form was `if (signature && !verify(...)) throw`, which
    // skipped verification entirely whenever the `signature` field was absent.
    // Omitting one key was enough to forge any delivery or bounce event for
    // any message. Fail closed instead.
    if (!settings.webhookSigningKey) {
      throw new BadRequestException(
        'Webhook signing key is not configured; refusing to accept unverified webhook events',
      );
    }

    const signature = payload['signature'] as Record<string, string> | undefined;
    if (!signature || !this.verifyWebhookSignature(settings, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const eventData = payload['event-data'] as Record<string, unknown> | undefined;
    if (!eventData) {
      return;
    }

    const event = eventData['event'] as string;
    const mailgunMessageId = eventData['message']
      ? (eventData['message'] as Record<string, unknown>)['headers']
        ? ((eventData['message'] as Record<string, unknown>)['headers'] as Record<string, string>)['message-id']
        : undefined
      : undefined;

    if (!mailgunMessageId) {
      return;
    }

    // Find the message by Message-ID header
    const message = await this.messageRepository.findOne({
      where: { messageId: `<${mailgunMessageId}>` },
    });

    if (!message) {
      return;
    }

    // Find outbound log
    const outboundLog = await this.outboundLogRepository.findOne({
      where: { messageId: message.id },
    });

    if (!outboundLog) {
      return;
    }

    // Update status based on event
    let status: OutboundStatus = outboundLog.status;
    let statusDetails: string | null = null;

    switch (event) {
      case 'delivered':
        status = 'delivered';
        break;
      case 'failed':
      case 'rejected':
        status = 'failed';
        statusDetails = (eventData['reason'] as string) || 'Delivery failed';
        break;
      case 'bounced':
        status = 'bounced';
        statusDetails = (eventData['reason'] as string) || 'Message bounced';
        break;
    }

    await this.outboundLogRepository.update(outboundLog.id, {
      status,
      statusDetails,
    });
  }

  private verifyWebhookSignature(
    settings: MailgunSettings,
    signature: Record<string, string>,
  ): boolean {
    // No "return true when unconfigured" escape hatch -- the caller already
    // rejects that case. A verifier that can return true without checking
    // anything is not a verifier.
    if (!settings.webhookSigningKey) {
      return false;
    }

    const { timestamp, token, signature: sig } = signature;
    if (!timestamp || !token || !sig) {
      return false;
    }

    // Reject stale signatures so a captured webhook cannot be replayed forever.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', settings.webhookSigningKey)
      .update(timestamp + token)
      .digest();

    let provided: Buffer;
    try {
      provided = Buffer.from(sig, 'hex');
    } catch {
      return false;
    }

    // timingSafeEqual throws on length mismatch, and `===` on secrets leaks
    // information through comparison time.
    if (provided.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, provided);
  }

  // Test method to send a simple email
  async sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    const settings = await this.getSettings();

    if (!settings.apiKey || !settings.domain || !settings.fromEmail) {
      throw new BadRequestException('Mailgun settings not configured');
    }

    const formData = new URLSearchParams();
    formData.append('from', `${settings.fromName} <${settings.fromEmail}>`);
    formData.append('to', to);
    formData.append('subject', 'Test Email from Recapito');
    formData.append('text', 'This is a test email sent from Recapito to verify your Mailgun configuration.');
    formData.append('html', '<h1>Test Email</h1><p>This is a test email sent from <strong>Recapito</strong> to verify your Mailgun configuration.</p>');

    const url = `${settings.baseUrl}/v3/${settings.domain}/messages`;
    const auth = Buffer.from(`api:${settings.apiKey}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as MailgunResponse;
    return { success: true, message: `Email sent! ID: ${result.id}` };
  }
}
