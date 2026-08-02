import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { ScheduledSendService } from './scheduled-send.service';
import { Draft } from '../../entities/draft.entity';
import { Mailbox } from '../../entities/mailbox.entity';
import { MailgunModule } from '../mailgun/mailgun.module';

@Module({
  // MailgunModule gives the scheduled-send worker the same delivery path the
  // interactive "send now" endpoint uses, so scheduled and immediate sends
  // cannot drift apart in behaviour.
  imports: [TypeOrmModule.forFeature([Draft, Mailbox]), MailgunModule],
  controllers: [DraftsController],
  providers: [DraftsService, ScheduledSendService],
  exports: [DraftsService],
})
export class DraftsModule {}
