import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmtpProvider } from '../../entities/smtp-provider.entity';
import { SmtpProvidersService } from './smtp-providers.service';
import { SmtpProvidersController } from './smtp-providers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SmtpProvider])],
  controllers: [SmtpProvidersController],
  providers: [SmtpProvidersService],
  exports: [SmtpProvidersService],
})
export class SmtpProvidersModule {}
