import { Test } from '@nestjs/testing';
import { describe, it, expect } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('AppModule bootstrapping integrity', () => {
  it('compiles all modules and resolves all controller/provider/guard dependencies without error', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
