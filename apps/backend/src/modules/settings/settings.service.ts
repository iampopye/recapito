import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../../entities/setting.entity';

export interface MailgunSettings {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  webhookSigningKey: string;
  baseUrl: string;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.settingRepository.findOne({ where: { key } });
    return setting?.value || null;
  }

  async set(key: string, value: string, description?: string): Promise<Setting> {
    let setting = await this.settingRepository.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      if (description) setting.description = description;
    } else {
      setting = this.settingRepository.create({ key, value, description });
    }
    return this.settingRepository.save(setting);
  }

  async getMailgunSettings(): Promise<MailgunSettings> {
    const keys = [
      'mailgun_api_key',
      'mailgun_domain',
      'mailgun_from_email',
      'mailgun_from_name',
      'mailgun_webhook_signing_key',
      'mailgun_base_url',
    ];

    const settings = await this.settingRepository.find({
      where: keys.map((key) => ({ key })),
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    return {
      apiKey: settingsMap.get('mailgun_api_key') || '',
      domain: settingsMap.get('mailgun_domain') || '',
      fromEmail: settingsMap.get('mailgun_from_email') || '',
      fromName: settingsMap.get('mailgun_from_name') || 'Sales',
      webhookSigningKey: settingsMap.get('mailgun_webhook_signing_key') || '',
      baseUrl: settingsMap.get('mailgun_base_url') || 'https://api.mailgun.net',
    };
  }

  async updateMailgunSettings(data: Partial<MailgunSettings>): Promise<MailgunSettings> {
    const mappings: Record<keyof MailgunSettings, string> = {
      apiKey: 'mailgun_api_key',
      domain: 'mailgun_domain',
      fromEmail: 'mailgun_from_email',
      fromName: 'mailgun_from_name',
      webhookSigningKey: 'mailgun_webhook_signing_key',
      baseUrl: 'mailgun_base_url',
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== '') {
        const settingKey = mappings[key as keyof MailgunSettings];
        if (settingKey) {
          await this.set(settingKey, value);
        }
      }
    }

    return this.getMailgunSettings();
  }

  async getMailgunSettingsForDisplay(): Promise<Partial<MailgunSettings>> {
    const settings = await this.getMailgunSettings();
    return {
      ...settings,
      apiKey: settings.apiKey ? '********' + settings.apiKey.slice(-4) : '',
      webhookSigningKey: settings.webhookSigningKey
        ? '********' + settings.webhookSigningKey.slice(-4)
        : '',
    };
  }
}
