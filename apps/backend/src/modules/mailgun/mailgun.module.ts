import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../../entities/message.entity';
import { Mailbox } from '../../entities/mailbox.entity';
import { OutboundLog } from '../../entities/outbound-log.entity';
import { MailgunService } from './mailgun.service';
import { MailgunController } from './mailgun.controller';
import { ThreadsModule } from '../threads/threads.module';
import { MailboxesModule } from '../mailboxes/mailboxes.module';
import { SettingsModule } from '../settings/settings.module';
import { SmtpProvidersModule } from '../smtp-providers/smtp-providers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Mailbox, OutboundLog]),
    ThreadsModule,
    MailboxesModule,
    SettingsModule,
    SmtpProvidersModule,
  ],
  controllers: [MailgunController],
  providers: [MailgunService],
  exports: [MailgunService],
})
export class MailgunModule {}
