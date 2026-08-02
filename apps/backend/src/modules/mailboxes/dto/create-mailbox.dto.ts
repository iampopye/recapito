import { IsEmail, IsString, IsNumber, IsBoolean, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class CreateMailboxDto {
  @IsEmail()
  email: string;

  @IsString()
  imapHost: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  imapPort: number;

  @IsBoolean()
  imapSsl: boolean;

  @IsString()
  imapUsername: string;

  @IsString()
  imapPassword: string;

  @IsOptional()
  @IsUUID()
  smtpProviderId?: string;
}
