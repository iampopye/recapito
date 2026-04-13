import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { Draft } from '../../entities/draft.entity';
import { Mailbox } from '../../entities/mailbox.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Draft, Mailbox])],
  controllers: [DraftsController],
  providers: [DraftsService],
  exports: [DraftsService],
})
export class DraftsModule {}
