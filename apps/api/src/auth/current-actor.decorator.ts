import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthActor } from './auth.types.js';

export type AuthenticatedRequest = Request & { actor?: AuthActor };

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthActor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.actor === undefined) {
      throw new Error('Authentication guard did not provide an actor.');
    }
    return request.actor;
  },
);
