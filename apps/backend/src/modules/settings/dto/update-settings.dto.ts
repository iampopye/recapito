import { IsString, IsOptional } from 'class-validator';

export class UpdateMailgunSettingsDto {
  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  fromEmail?: string;

  @IsString()
  @IsOptional()
  fromName?: string;

  @IsString()
  @IsOptional()
  webhookSigningKey?: string;

  @IsString()
  @IsOptional()
  baseUrl?: string;
}
