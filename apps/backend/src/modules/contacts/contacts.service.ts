import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Contact } from '../../entities/contact.entity';

interface CreateContactDto {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  notes?: string;
}

interface UpdateContactDto {
  name?: string;
  company?: string;
  phone?: string;
  notes?: string;
  isFavorite?: boolean;
}

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {}

  async findAllByUser(userId: string, search?: string): Promise<Contact[]> {
    const query = this.contactRepository
      .createQueryBuilder('contact')
      .where('contact.user_id = :userId', { userId });

    if (search) {
      query.andWhere(
        '(contact.email ILIKE :search OR contact.name ILIKE :search OR contact.company ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    return query
      .orderBy('contact.is_favorite', 'DESC')
      .addOrderBy('contact.contact_count', 'DESC')
      .addOrderBy('contact.name', 'ASC')
      .getMany();
  }

  async findFavorites(userId: string): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { userId, isFavorite: true },
      order: { name: 'ASC' },
    });
  }

  async findFrequent(userId: string, limit = 10): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { userId },
      order: { contactCount: 'DESC' },
      take: limit,
    });
  }

  async create(userId: string, data: CreateContactDto): Promise<Contact> {
    const existing = await this.contactRepository.findOne({
      where: { userId, email: data.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Contact with this email already exists');
    }

    const contact = this.contactRepository.create({
      userId,
      email: data.email.toLowerCase(),
      name: data.name || null,
      company: data.company || null,
      phone: data.phone || null,
      notes: data.notes || null,
    });

    return this.contactRepository.save(contact);
  }

  async update(id: string, userId: string, data: UpdateContactDto): Promise<Contact> {
    const contact = await this.contactRepository.findOne({
      where: { id, userId },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (data.name !== undefined) contact.name = data.name;
    if (data.company !== undefined) contact.company = data.company;
    if (data.phone !== undefined) contact.phone = data.phone;
    if (data.notes !== undefined) contact.notes = data.notes;
    if (data.isFavorite !== undefined) contact.isFavorite = data.isFavorite;

    return this.contactRepository.save(contact);
  }

  async delete(id: string, userId: string): Promise<void> {
    const contact = await this.contactRepository.findOne({
      where: { id, userId },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    await this.contactRepository.remove(contact);
  }

  async incrementContactCount(userId: string, email: string): Promise<void> {
    const contact = await this.contactRepository.findOne({
      where: { userId, email: email.toLowerCase() },
    });

    if (contact) {
      contact.contactCount += 1;
      contact.lastContactedAt = new Date();
      await this.contactRepository.save(contact);
    }
  }

  async findOrCreate(userId: string, email: string, name?: string): Promise<Contact> {
    let contact = await this.contactRepository.findOne({
      where: { userId, email: email.toLowerCase() },
    });

    if (!contact) {
      contact = this.contactRepository.create({
        userId,
        email: email.toLowerCase(),
        name: name || null,
      });
      contact = await this.contactRepository.save(contact);
    }

    return contact;
  }
}
