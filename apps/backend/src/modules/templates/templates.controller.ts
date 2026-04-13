import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.templatesService.findAllByUser(user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.templatesService.findById(id, user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() body: {
      name: string;
      subject?: string;
      bodyText?: string;
      bodyHtml?: string;
      shortcut?: string;
    },
  ) {
    return this.templatesService.create(user.id, body);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      subject?: string;
      bodyText?: string;
      bodyHtml?: string;
      shortcut?: string;
    },
  ) {
    return this.templatesService.update(id, user.id, body);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.templatesService.delete(id, user.id);
    return { success: true };
  }

  @Post(':id/use')
  async markAsUsed(@CurrentUser() user: User, @Param('id') id: string) {
    await this.templatesService.incrementUseCount(id, user.id);
    return this.templatesService.findById(id, user.id);
  }
}
