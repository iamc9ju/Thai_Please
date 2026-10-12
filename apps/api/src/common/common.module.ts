import { Global, Module } from '@nestjs/common';
import { PrototypePolicyService } from './policy/prototype-policy.service.js';
import { SystemClock } from './time/clock.js';

@Global()
@Module({
  exports: [PrototypePolicyService, SystemClock],
  providers: [PrototypePolicyService, SystemClock],
})
export class CommonModule {}
