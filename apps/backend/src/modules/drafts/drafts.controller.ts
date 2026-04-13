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
import { DraftsService } from './drafts.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';

@Controller('drafts')
@UseGuards(JwtAuthGuard)
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.draftsService.findAllByUser(user.id);
  }

  @Get('scheduled')
  async findScheduled(@CurrentUser() user: User) {
    return this.draftsService.findScheduledByUser(user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.draftsService.findById(id, user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() body: {
      mailboxId: string;
      threadId?: string;
      inReplyTo?: string;
      toAddresses?: string[];
      ccAddresses?: string[];
      bccAddresses?: string[];
      subject?: string;
      bodyText?: string;
      bodyHtml?: string;
      scheduledAt?: string;
    },
  ) {
    return this.draftsService.create(user.id, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: {
      toAddresses?: string[];
      ccAddresses?: string[];
      bccAddresses?: string[];
      subject?: string;
      bodyText?: string;
      bodyHtml?: string;
      scheduledAt?: string | null;
    },
  ) {
    return this.draftsService.update(id, user.id, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : body.scheduledAt === null ? null : undefined,
    });
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.draftsService.delete(id, user.id);
    return { success: true };
  }
}
