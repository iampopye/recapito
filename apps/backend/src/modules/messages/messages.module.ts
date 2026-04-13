import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../../entities/message.entity';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ThreadsModule } from '../threads/threads.module';
import { MailboxesModule } from '../mailboxes/mailboxes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    ThreadsModule,
    MailboxesModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
