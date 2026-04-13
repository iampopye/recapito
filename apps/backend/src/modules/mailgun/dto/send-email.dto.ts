import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';

export class SendEmailDto {
  @IsOptional()
  @IsUUID()
  threadId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  to: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;
}
