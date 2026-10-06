import { ConsoleLogger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/http/global-exception.filter.js';
import { APPLICATION_METADATA } from './config/application.constants.js';
import type { EnvironmentVariables } from './config/environment.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const appName = config.get('APP_NAME', { infer: true });
  const apiPrefix = config.get('API_PREFIX', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  const enableSwagger = config.get('ENABLE_SWAGGER', { infer: true });
  const port = config.get('PORT', { infer: true });

  app.useLogger(
    new ConsoleLogger(appName, {
      json: true,
      colors: false,
      timestamp: true,
    }),
  );
  app.setGlobalPrefix(apiPrefix);
  app.use(helmet());
  app.enableVersioning({ type: VersioningType.URI });
  app.enableCors({
    credentials: true,
    origin: corsOrigins,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  if (enableSwagger) {
    const openApiConfig = new DocumentBuilder()
      .setTitle(appName)
      .setDescription(APPLICATION_METADATA.openApiDescription)
      .setVersion(APPLICATION_METADATA.apiVersion)
      .build();
    const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
    SwaggerModule.setup(
      `${apiPrefix}/${APPLICATION_METADATA.openApiPath}`,
      app,
      openApiDocument,
    );
  }

  await app.listen(port);
}

await bootstrap();
