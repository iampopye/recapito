import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { Label } from '../../entities/label.entity';
import { Thread } from '../../entities/thread.entity';
import { Mailbox } from '../../entities/mailbox.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Label, Thread, Mailbox])],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
