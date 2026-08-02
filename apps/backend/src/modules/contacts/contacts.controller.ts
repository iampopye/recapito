import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async findAll(@CurrentUser() user: User, @Query('search') search?: string) {
    return this.contactsService.findAllByUser(user.id, search);
  }

  @Get('favorites')
  async findFavorites(@CurrentUser() user: User) {
    return this.contactsService.findFavorites(user.id);
  }

  @Get('frequent')
  async findFrequent(@CurrentUser() user: User, @Query('limit') limit?: string) {
    return this.contactsService.findFrequent(user.id, limit ? parseInt(limit, 10) : 10);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() body: { email: string; name?: string; company?: string; phone?: string; notes?: string },
  ) {
    return this.contactsService.create(user.id, body);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { name?: string; company?: string; phone?: string; notes?: string; isFavorite?: boolean },
  ) {
    return this.contactsService.update(id, user.id, body);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.contactsService.delete(id, user.id);
    return { success: true };
  }

  @Post(':id/favorite')
  async toggleFavorite(@CurrentUser() user: User, @Param('id') id: string) {
    const contact = await this.contactsService.findAllByUser(user.id);
    const current = contact.find((c) => c.id === id);
    if (!current) {
      return { success: false };
    }
    return this.contactsService.update(id, user.id, { isFavorite: !current.isFavorite });
  }
}
