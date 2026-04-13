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
import { LabelsService } from './labels.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';

@Controller('labels')
@UseGuards(JwtAuthGuard)
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.labelsService.findAllByUser(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() body: { name: string; color?: string },
  ) {
    return this.labelsService.create(user.id, body);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string },
  ) {
    return this.labelsService.update(id, user.id, body);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.labelsService.delete(id, user.id);
    return { success: true };
  }

  @Get(':id/threads')
  async getThreadsByLabel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.labelsService.getThreadsByLabel(id, user.id);
  }

  @Post(':labelId/threads/:threadId')
  async addToThread(
    @CurrentUser() user: User,
    @Param('labelId') labelId: string,
    @Param('threadId') threadId: string,
  ) {
    return this.labelsService.addLabelToThread(threadId, labelId, user.id);
  }

  @Delete(':labelId/threads/:threadId')
  async removeFromThread(
    @CurrentUser() user: User,
    @Param('labelId') labelId: string,
    @Param('threadId') threadId: string,
  ) {
    return this.labelsService.removeLabelFromThread(threadId, labelId, user.id);
  }
}
