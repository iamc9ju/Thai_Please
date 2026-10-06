import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

describe('Health endpoints', () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://test:test@127.0.0.1:5432/thai_please_test';
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves liveness without requiring PostgreSQL', async () => {
    if (app === undefined) {
      throw new Error('Test application was not initialized');
    }

    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect('x-request-id', /^[0-9a-f-]{36}$/i)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
      });
  });

  it('reports PostgreSQL readiness', async () => {
    if (app === undefined) {
      throw new Error('Test application was not initialized');
    }

    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.info.database.status).toBe('up');
      });
  });
});
