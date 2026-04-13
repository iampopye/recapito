import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signature } from '../../entities/signature.entity';

@Injectable()
export class SignaturesService {
  constructor(
    @InjectRepository(Signature)
    private readonly signatureRepository: Repository<Signature>,
  ) {}

  async findAllByUser(userId: string): Promise<Signature[]> {
    return this.signatureRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async findDefault(userId: string): Promise<Signature | null> {
    return this.signatureRepository.findOne({
      where: { userId, isDefault: true },
    });
  }

  async create(userId: string, data: { name: string; content: string; isDefault?: boolean }): Promise<Signature> {
    if (data.isDefault) {
      await this.signatureRepository.update({ userId }, { isDefault: false });
    }

    const signature = this.signatureRepository.create({
      userId,
      name: data.name,
      content: data.content,
      isDefault: data.isDefault || false,
    });

    return this.signatureRepository.save(signature);
  }

  async update(id: string, userId: string, data: { name?: string; content?: string; isDefault?: boolean }): Promise<Signature> {
    const signature = await this.signatureRepository.findOne({
      where: { id, userId },
    });
    if (!signature) {
      throw new NotFoundException('Signature not found');
    }

    if (data.isDefault) {
      await this.signatureRepository.update({ userId }, { isDefault: false });
    }

    if (data.name !== undefined) signature.name = data.name;
    if (data.content !== undefined) signature.content = data.content;
    if (data.isDefault !== undefined) signature.isDefault = data.isDefault;

    return this.signatureRepository.save(signature);
  }

  async delete(id: string, userId: string): Promise<void> {
    const signature = await this.signatureRepository.findOne({
      where: { id, userId },
    });
    if (!signature) {
      throw new NotFoundException('Signature not found');
    }
    await this.signatureRepository.remove(signature);
  }
}
