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

type DomainErrorBody = { code: string; message: string };

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
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const domainError = this.parseDomainError(exceptionResponse);

    response.status(status).json({
      error: {
        code: isServerError
          ? ERROR_CODES.internal
          : (domainError?.code ?? ERROR_CODES.requestFailed),
        message: isServerError
          ? ERROR_MESSAGES.internal
          : (domainError?.message ?? ERROR_MESSAGES.requestFailed),
        requestId,
      },
      path: request.path,
      timestamp: new Date().toISOString(),
    });
  }

  private parseDomainError(value: unknown): DomainErrorBody | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    if (!('code' in value) || !('message' in value)) return undefined;
    return typeof value.code === 'string' && typeof value.message === 'string'
      ? { code: value.code, message: value.message }
      : undefined;
  }

  private resolveRequestId(request: Request): string {
    const requestId = request.headers[HTTP_HEADERS.requestId];
    return typeof requestId === 'string' && REQUEST_ID_PATTERN.test(requestId)
      ? requestId
      : randomUUID();
  }
}
