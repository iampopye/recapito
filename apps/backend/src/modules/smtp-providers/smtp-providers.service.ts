import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { Readable } from 'stream';
import FormData from 'form-data';
import { SmtpProvider, SmtpProviderType } from '../../entities/smtp-provider.entity';

interface CreateSmtpProviderDto {
  name: string;
  type: SmtpProviderType;
  fromEmail: string;
  fromName?: string;
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  brevoApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  isDefault?: boolean;
}

interface UpdateSmtpProviderDto {
  name?: string;
  type?: SmtpProviderType;
  fromEmail?: string;
  fromName?: string;
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  brevoApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

interface SendEmailParams {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string | null;
}

@Injectable()
export class SmtpProvidersService {
  constructor(
    @InjectRepository(SmtpProvider)
    private readonly smtpProviderRepository: Repository<SmtpProvider>,
  ) {}

  async findAll(userId: string): Promise<SmtpProvider[]> {
    return this.smtpProviderRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async findById(id: string, userId: string): Promise<SmtpProvider> {
    const provider = await this.smtpProviderRepository.findOne({
      where: { id, userId },
    });
    if (!provider) {
      throw new NotFoundException('SMTP provider not found');
    }
    return provider;
  }

  async findDefault(userId: string): Promise<SmtpProvider | null> {
    return this.smtpProviderRepository.findOne({
      where: { userId, isDefault: true, isActive: true },
    });
  }

  async create(userId: string, dto: CreateSmtpProviderDto): Promise<SmtpProvider> {
    // Validate required fields based on provider type
    this.validateProviderSettings(dto.type, dto);

    // If this is set as default, unset other defaults
    if (dto.isDefault) {
      await this.smtpProviderRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    const provider = this.smtpProviderRepository.create({
      userId,
      ...dto,
    });

    return this.smtpProviderRepository.save(provider);
  }

  async update(id: string, userId: string, dto: UpdateSmtpProviderDto): Promise<SmtpProvider> {
    const provider = await this.findById(id, userId);

    // Validate settings if type is being changed
    const type = dto.type || provider.type;
    const settingsToValidate = {
      ...dto,
      mailgunApiKey: dto.mailgunApiKey ?? provider.mailgunApiKey ?? undefined,
      mailgunDomain: dto.mailgunDomain ?? provider.mailgunDomain ?? undefined,
      brevoApiKey: dto.brevoApiKey ?? provider.brevoApiKey ?? undefined,
      smtpHost: dto.smtpHost ?? provider.smtpHost ?? undefined,
      smtpPort: dto.smtpPort ?? provider.smtpPort ?? undefined,
    };
    this.validateProviderSettings(type, settingsToValidate);

    // If setting as default, unset other defaults
    if (dto.isDefault && !provider.isDefault) {
      await this.smtpProviderRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    Object.assign(provider, dto);
    return this.smtpProviderRepository.save(provider);
  }

  async delete(id: string, userId: string): Promise<void> {
    const provider = await this.findById(id, userId);
    await this.smtpProviderRepository.remove(provider);
  }

  async testConnection(id: string, userId: string, testEmail: string): Promise<{ success: boolean; message: string }> {
    const provider = await this.findById(id, userId);

    try {
      await this.sendEmail(provider, {
        from: `${provider.fromName || 'Test'} <${provider.fromEmail}>`,
        to: [testEmail],
        subject: 'Test Email from Recapito',
        text: `This is a test email sent via ${provider.name} (${provider.type}) to verify your SMTP configuration.`,
        html: `<h1>Test Email</h1><p>This is a test email sent via <strong>${provider.name}</strong> (${provider.type}) to verify your SMTP configuration.</p>`,
      });
      return { success: true, message: `Test email sent successfully via ${provider.name}` };
    } catch (error) {
      throw new BadRequestException(
        `Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendEmail(provider: SmtpProvider, params: SendEmailParams): Promise<{ id: string }> {
    switch (provider.type) {
      case 'mailgun':
        return this.sendViaMailgun(provider, params);
      case 'brevo':
        return this.sendViaBrevo(provider, params);
      case 'smtp':
        return this.sendViaSmtp(provider, params);
      default:
        throw new BadRequestException(`Unsupported provider type: ${provider.type}`);
    }
  }

  private async sendViaMailgun(
    provider: SmtpProvider,
    params: SendEmailParams,
  ): Promise<{ id: string }> {
    if (!provider.mailgunApiKey || !provider.mailgunDomain) {
      throw new BadRequestException('Mailgun API key and domain are required');
    }

    const formData = new URLSearchParams();
    formData.append('from', params.from);
    params.to.forEach((to) => formData.append('to', to));
    if (params.cc) {
      params.cc.forEach((cc) => formData.append('cc', cc));
    }
    formData.append('subject', params.subject);
    if (params.text) formData.append('text', params.text);
    if (params.html) formData.append('html', params.html);
    if (params.messageId) formData.append('h:Message-ID', params.messageId);
    if (params.inReplyTo) {
      formData.append('h:In-Reply-To', params.inReplyTo);
      formData.append('h:References', params.inReplyTo);
    }

    const baseUrl = provider.mailgunBaseUrl || 'https://api.mailgun.net';
    const url = `${baseUrl}/v3/${provider.mailgunDomain}/messages`;
    const auth = Buffer.from(`api:${provider.mailgunApiKey}`).toString('base64');

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

    const result = (await response.json()) as { id: string; message: string };
    return { id: result.id };
  }

  private async sendViaBrevo(
    provider: SmtpProvider,
    params: SendEmailParams,
  ): Promise<{ id: string }> {
    if (!provider.brevoApiKey) {
      throw new BadRequestException('Brevo API key is required');
    }

    const payload = {
      sender: {
        name: provider.fromName || params.from.split('<')[0].trim(),
        email: provider.fromEmail,
      },
      to: params.to.map((email) => ({ email })),
      cc: params.cc?.map((email) => ({ email })),
      subject: params.subject,
      textContent: params.text,
      htmlContent: params.html,
      headers: params.messageId
        ? {
            'Message-ID': params.messageId,
            ...(params.inReplyTo ? { 'In-Reply-To': params.inReplyTo, References: params.inReplyTo } : {}),
          }
        : undefined,
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': provider.brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as { messageId: string };
    return { id: result.messageId };
  }

  private async sendViaSmtp(
    provider: SmtpProvider,
    params: SendEmailParams,
  ): Promise<{ id: string }> {
    if (!provider.smtpHost || !provider.smtpPort) {
      throw new BadRequestException('SMTP host and port are required');
    }

    const transporter = nodemailer.createTransport({
      host: provider.smtpHost,
      port: provider.smtpPort,
      secure: provider.smtpSecure,
      auth: provider.smtpUsername
        ? {
            user: provider.smtpUsername,
            pass: provider.smtpPassword || '',
          }
        : undefined,
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from: params.from,
      to: params.to.join(', '),
      cc: params.cc?.join(', '),
      subject: params.subject,
      text: params.text,
      html: params.html,
      messageId: params.messageId,
      inReplyTo: params.inReplyTo || undefined,
      references: params.inReplyTo || undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    return { id: info.messageId };
  }

  private validateProviderSettings(type: SmtpProviderType, dto: Partial<CreateSmtpProviderDto>): void {
    switch (type) {
      case 'mailgun':
        if (!dto.mailgunApiKey || !dto.mailgunDomain) {
          throw new BadRequestException('Mailgun requires API key and domain');
        }
        break;
      case 'brevo':
        if (!dto.brevoApiKey) {
          throw new BadRequestException('Brevo requires API key');
        }
        break;
      case 'smtp':
        if (!dto.smtpHost || !dto.smtpPort) {
          throw new BadRequestException('SMTP requires host and port');
        }
        break;
    }
  }

  // Mask sensitive data for display
  maskProvider(provider: SmtpProvider): SmtpProvider {
    const masked = { ...provider };
    if (masked.mailgunApiKey) {
      masked.mailgunApiKey = this.maskString(masked.mailgunApiKey);
    }
    if (masked.brevoApiKey) {
      masked.brevoApiKey = this.maskString(masked.brevoApiKey);
    }
    if (masked.smtpPassword) {
      masked.smtpPassword = '********';
    }
    return masked;
  }

  private maskString(str: string): string {
    if (str.length <= 8) return '********';
    return str.substring(0, 4) + '********' + str.substring(str.length - 4);
  }
}
