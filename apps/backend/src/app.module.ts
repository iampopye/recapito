import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MailboxesModule } from './modules/mailboxes/mailboxes.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { MessagesModule } from './modules/messages/messages.module';
import { MailgunModule } from './modules/mailgun/mailgun.module';
import { HealthModule } from './modules/health/health.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SmtpProvidersModule } from './modules/smtp-providers/smtp-providers.module';
import { LabelsModule } from './modules/labels/labels.module';
import { DraftsModule } from './modules/drafts/drafts.module';
import { SignaturesModule } from './modules/signatures/signatures.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      // Refuses to boot when a required secret is missing or is a known
      // placeholder, instead of starting up silently insecure.
      validate: validateEnv,
    }),
    CryptoModule,
    // Drives the scheduled-send worker in DraftsModule. Without this, drafts
    // given a send time are stored and never delivered.
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get('DATABASE_USERNAME', 'recapito'),
        // No default. A shipped default database password is a credential
        // published in the repo.
        password: configService.getOrThrow<string>('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME', 'recapito'),
        entities: [__dirname + '/entities/*.entity{.ts,.js}'],
        // Opt-in only, never inferred. This used to be
        // `NODE_ENV !== 'production'`, so an unset NODE_ENV -- the default in
        // plenty of environments -- silently enabled schema auto-sync, which
        // can drop columns and their data on boot. Migrations are the only
        // supported way to change the schema.
        synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
        migrationsRun: configService.get('DB_MIGRATIONS_RUN', 'true') === 'true',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    MailboxesModule,
    ThreadsModule,
    MessagesModule,
    MailgunModule,
    SettingsModule,
    SmtpProvidersModule,
    LabelsModule,
    DraftsModule,
    SignaturesModule,
    ContactsModule,
    TemplatesModule,
    AttachmentsModule,
  ],
})
export class AppModule {}
