import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

describe('OpenAPI contract (NFR-MAINT-02)', () => {
  it('documents bearer auth and required prototype endpoints without register/refund mutation', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.DATABASE_URL =
      'postgresql://test:test@127.0.0.1:5432/thai_please_test';
    const { AppModule } = await import('../src/app.module.js');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('test')
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    expect(document.components?.securitySchemes?.bearer).toBeDefined();
    expect(document.paths['/api/v1/auth/login']).toBeDefined();
    expect(document.paths['/api/v1/auth/register']).toBeUndefined();
    expect(document.paths['/api/v1/orders/{id}/checkout']).toBeDefined();
    expect(document.paths['/api/v1/orders/{id}/pay']).toBeDefined();
    expect(document.paths['/api/v1/orders/{id}/refund']).toBeUndefined();
    expect(document.paths['/api/v1/dashboard/social-impact']).toBeDefined();
    await app.close();
  });
});
