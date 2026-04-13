import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mailbox } from '../../entities/mailbox.entity';
import { MailboxesService } from './mailboxes.service';
import { MailboxesController } from './mailboxes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Mailbox])],
  controllers: [MailboxesController],
  providers: [MailboxesService],
  exports: [MailboxesService],
})
export class MailboxesModule {}
