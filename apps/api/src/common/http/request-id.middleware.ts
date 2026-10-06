import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { HTTP_HEADERS, REQUEST_ID_PATTERN } from './http.constants.js';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const candidate = request.header(HTTP_HEADERS.requestId);
    const requestId =
      candidate && REQUEST_ID_PATTERN.test(candidate)
        ? candidate
        : randomUUID();

    request.headers[HTTP_HEADERS.requestId] = requestId;
    response.setHeader(HTTP_HEADERS.requestId, requestId);
    next();
  }
}
