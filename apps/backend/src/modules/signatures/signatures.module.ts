import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignaturesController } from './signatures.controller';
import { SignaturesService } from './signatures.service';
import { Signature } from '../../entities/signature.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Signature])],
  controllers: [SignaturesController],
  providers: [SignaturesService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
