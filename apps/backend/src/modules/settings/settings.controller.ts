import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateMailgunSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('mailgun')
  async getMailgunSettings(@CurrentUser() user: User) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.settingsService.getMailgunSettingsForDisplay();
  }

  @Put('mailgun')
  async updateMailgunSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateMailgunSettingsDto,
  ) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.settingsService.updateMailgunSettings(dto);
  }
}
