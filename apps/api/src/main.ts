import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { parseCorsOrigins } from './config/environment.js';

// Support JSON serialization of BigInt values
(BigInt.prototype as unknown as { toJSON: (this: bigint) => string }).toJSON =
  function (this: bigint) {
    return this.toString();
  };

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const apiPrefix = config.getOrThrow<string>('API_PREFIX');

  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  app.setGlobalPrefix(apiPrefix);

  // Enable CORS based on CORS_ORIGINS
  const allowedOrigins = parseCorsOrigins(
    config.getOrThrow<string>('CORS_ORIGINS'),
  );
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  Logger.log(`API listening on port ${port} with prefix /${apiPrefix}`);
}

await bootstrap();
