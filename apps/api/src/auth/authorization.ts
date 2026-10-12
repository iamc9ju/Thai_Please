import { HttpStatus } from '@nestjs/common';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import type { AuthActor } from './auth.types.js';

export function requireConsumer(actor: AuthActor): void {
  if (actor.role !== 'CONSUMER') {
    throw new DomainException(DOMAIN_ERRORS.forbidden, HttpStatus.FORBIDDEN);
  }
}
