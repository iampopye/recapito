import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class UpdateMailboxDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  imapHost?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  imapPort?: number;

  @IsOptional()
  @IsBoolean()
  imapSsl?: boolean;

  @IsOptional()
  @IsString()
  imapUsername?: string;

  @IsOptional()
  @IsString()
  imapPassword?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  smtpProviderId?: string | null;
}
