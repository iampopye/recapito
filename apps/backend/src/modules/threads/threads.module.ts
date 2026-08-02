import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Thread } from '../../entities/thread.entity';
import { Mailbox } from '../../entities/mailbox.entity';
import { Message } from '../../entities/message.entity';
import { ThreadsService } from './threads.service';
import { ThreadsController } from './threads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Thread, Mailbox, Message])],
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
