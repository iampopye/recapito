import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MailboxesService } from './mailboxes.service';
import { CreateMailboxDto } from './dto/create-mailbox.dto';
import { UpdateMailboxDto } from './dto/update-mailbox.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';

@Controller('mailboxes')
@UseGuards(JwtAuthGuard)
export class MailboxesController {
  constructor(private readonly mailboxesService: MailboxesService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateMailboxDto) {
    return this.mailboxesService.create(user.id, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.mailboxesService.findAllByUser(user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.mailboxesService.findById(id, user.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMailboxDto,
  ) {
    return this.mailboxesService.update(id, user.id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.mailboxesService.delete(id, user.id);
    return { success: true };
  }
}
