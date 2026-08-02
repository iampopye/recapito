import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('BACKEND_PORT', 3001);

  app.use(helmet());

  // `origin: true` reflects whatever Origin the caller sends, and combined with
  // `credentials: true` that means any website a logged-in user visits can call
  // this API with their cookies. Pin it to an explicit allowlist instead.
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    // Local development default. Anything deployed must set CORS_ORIGINS.
    corsOrigins.push('http://localhost:3000');
    logger.warn(
      'CORS_ORIGINS is not set; defaulting to http://localhost:3000. ' +
        'Set CORS_ORIGINS to your frontend URL before deploying.',
    );
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  await app.listen(port);
  logger.log(`Backend listening on port ${port}`);
  logger.log(`CORS allowed origins: ${corsOrigins.join(', ')}`);
}

bootstrap();
