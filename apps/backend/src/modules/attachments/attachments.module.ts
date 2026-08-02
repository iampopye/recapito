import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentStorageService } from './attachment-storage.service';
import { Attachment } from '../../entities/attachment.entity';
import { Message } from '../../entities/message.entity';
import { Mailbox } from '../../entities/mailbox.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment, Message, Mailbox])],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentStorageService],
  exports: [AttachmentsService, AttachmentStorageService],
})
export class AttachmentsModule {}
