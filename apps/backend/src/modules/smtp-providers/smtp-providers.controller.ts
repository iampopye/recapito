import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SmtpProvidersService } from './smtp-providers.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';
import type { SmtpProviderType } from '../../entities/smtp-provider.entity';

interface CreateSmtpProviderDto {
  name: string;
  type: SmtpProviderType;
  fromEmail: string;
  fromName?: string;
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  brevoApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  isDefault?: boolean;
}

interface UpdateSmtpProviderDto {
  name?: string;
  type?: SmtpProviderType;
  fromEmail?: string;
  fromName?: string;
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  brevoApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

@Controller('smtp-providers')
@UseGuards(JwtAuthGuard)
export class SmtpProvidersController {
  constructor(private readonly smtpProvidersService: SmtpProvidersService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    const providers = await this.smtpProvidersService.findAll(user.id);
    return providers.map((p) => this.smtpProvidersService.maskProvider(p));
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const provider = await this.smtpProvidersService.findById(id, user.id);
    return this.smtpProvidersService.maskProvider(provider);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateSmtpProviderDto) {
    const provider = await this.smtpProvidersService.create(user.id, dto);
    return this.smtpProvidersService.maskProvider(provider);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateSmtpProviderDto,
  ) {
    const provider = await this.smtpProvidersService.update(id, user.id, dto);
    return this.smtpProvidersService.maskProvider(provider);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.smtpProvidersService.delete(id, user.id);
  }

  @Post(':id/test')
  async testConnection(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { email: string },
  ) {
    return this.smtpProvidersService.testConnection(id, user.id, body.email);
  }
}
