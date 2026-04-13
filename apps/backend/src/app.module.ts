import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get('DATABASE_USERNAME', 'imark'),
        password: configService.get('DATABASE_PASSWORD', 'imark_secret'),
        database: configService.get('DATABASE_NAME', 'imark_mailer'),
        entities: [__dirname + '/entities/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production',
        migrationsRun: configService.get('NODE_ENV') === 'production',
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
  ],
})
export class AppModule {}
