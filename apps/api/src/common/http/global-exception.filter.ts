import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  HTTP_HEADERS,
  REQUEST_ID_PATTERN,
} from './http.constants.js';

type ErrorResponseBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
  path: string;
  timestamp: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response<ErrorResponseBody>>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = this.resolveRequestId(request);
    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      error: {
        code: isServerError ? ERROR_CODES.internal : ERROR_CODES.requestFailed,
        message: isServerError
          ? ERROR_MESSAGES.internal
          : ERROR_MESSAGES.requestFailed,
        requestId,
      },
      path: request.path,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveRequestId(request: Request): string {
    const requestId = request.headers[HTTP_HEADERS.requestId];
    return typeof requestId === 'string' && REQUEST_ID_PATTERN.test(requestId)
      ? requestId
      : randomUUID();
  }
}
