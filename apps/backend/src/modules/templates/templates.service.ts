import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from '../../entities/template.entity';

interface CreateTemplateDto {
  name: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  shortcut?: string;
}

interface UpdateTemplateDto {
  name?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  shortcut?: string;
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
  ) {}

  async findAllByUser(userId: string): Promise<Template[]> {
    return this.templateRepository.find({
      where: { userId },
      order: { useCount: 'DESC', name: 'ASC' },
    });
  }

  async findById(id: string, userId: string): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: { id, userId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async findByShortcut(shortcut: string, userId: string): Promise<Template | null> {
    return this.templateRepository.findOne({
      where: { userId, shortcut },
    });
  }

  async create(userId: string, data: CreateTemplateDto): Promise<Template> {
    if (data.shortcut) {
      const existing = await this.findByShortcut(data.shortcut, userId);
      if (existing) {
        throw new BadRequestException('Shortcut already in use');
      }
    }

    const template = this.templateRepository.create({
      userId,
      name: data.name,
      subject: data.subject || null,
      bodyText: data.bodyText || null,
      bodyHtml: data.bodyHtml || null,
      shortcut: data.shortcut || '',
    });

    return this.templateRepository.save(template);
  }

  async update(id: string, userId: string, data: UpdateTemplateDto): Promise<Template> {
    const template = await this.findById(id, userId);

    if (data.shortcut && data.shortcut !== template.shortcut) {
      const existing = await this.findByShortcut(data.shortcut, userId);
      if (existing) {
        throw new BadRequestException('Shortcut already in use');
      }
    }

    if (data.name !== undefined) template.name = data.name;
    if (data.subject !== undefined) template.subject = data.subject;
    if (data.bodyText !== undefined) template.bodyText = data.bodyText;
    if (data.bodyHtml !== undefined) template.bodyHtml = data.bodyHtml;
    if (data.shortcut !== undefined) template.shortcut = data.shortcut;

    return this.templateRepository.save(template);
  }

  async delete(id: string, userId: string): Promise<void> {
    const template = await this.findById(id, userId);
    await this.templateRepository.remove(template);
  }

  async incrementUseCount(id: string, userId: string): Promise<void> {
    await this.templateRepository
      .createQueryBuilder()
      .update(Template)
      .set({ useCount: () => 'use_count + 1' })
      .where('id = :id AND user_id = :userId', { id, userId })
      .execute();
  }
}
