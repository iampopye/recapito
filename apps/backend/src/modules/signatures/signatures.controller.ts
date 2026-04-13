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
import { SignaturesService } from './signatures.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';

@Controller('signatures')
@UseGuards(JwtAuthGuard)
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.signaturesService.findAllByUser(user.id);
  }

  @Get('default')
  async findDefault(@CurrentUser() user: User) {
    return this.signaturesService.findDefault(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() body: { name: string; content: string; isDefault?: boolean },
  ) {
    return this.signaturesService.create(user.id, body);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { name?: string; content?: string; isDefault?: boolean },
  ) {
    return this.signaturesService.update(id, user.id, body);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.signaturesService.delete(id, user.id);
    return { success: true };
  }
}
