import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ThreadsService, FolderCounts } from './threads.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';
import { ThreadFolder } from '../../entities/thread.entity';

@Controller('threads')
@UseGuards(JwtAuthGuard)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('mailboxId') mailboxId?: string,
    @Query('folder') folder?: ThreadFolder,
    @Query('search') search?: string,
  ) {
    return this.threadsService.findAllByUser(user.id, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      mailboxId,
      folder,
      search,
    });
  }

  @Get('counts')
  async getFolderCounts(
    @CurrentUser() user: User,
    @Query('mailboxId') mailboxId?: string,
  ): Promise<FolderCounts> {
    return this.threadsService.getFolderCounts(user.id, mailboxId);
  }

  @Get('search')
  async searchMessages(
    @CurrentUser() user: User,
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('mailboxId') mailboxId?: string,
  ) {
    return this.threadsService.searchMessages(user.id, query || '', {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      mailboxId,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.threadsService.findById(id, user.id);
  }

  @Post(':id/read')
  async markAsRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.threadsService.markAsRead(id, user.id);
  }

  @Post(':id/move')
  async moveToFolder(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body('folder') folder: ThreadFolder,
  ) {
    return this.threadsService.moveToFolder(id, user.id, folder);
  }

  @Post(':id/star')
  async toggleStar(@CurrentUser() user: User, @Param('id') id: string) {
    return this.threadsService.toggleStar(id, user.id);
  }
}
