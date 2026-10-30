import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  code: string;
  message: string | string[];
  details?: unknown;
  timestamp: string;
  path: string;
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE_ENTITY';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR';
  }
}

function extractConstraintName(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const msg =
    'originalMessage' in err && typeof err.originalMessage === 'string'
      ? err.originalMessage
      : 'message' in err && typeof err.message === 'string'
        ? err.message
        : '';
  const match = /violates (?:check|exclusion) constraint "([^"]+)"/i.exec(msg);
  return match ? match[1]! : null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isDev = process.env.NODE_ENV !== 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let code = 'INTERNAL_SERVER_ERROR';
    let message: string | string[] = 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = HttpStatus[status] ?? 'Error';
        code = defaultCodeForStatus(status);
      } else if (typeof res === 'object' && res !== null) {
        const payload = res as Record<string, unknown>;
        const rawMessage = payload.message;

        if (Array.isArray(rawMessage)) {
          // ValidationPipe array of error strings
          status = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          code = 'VALIDATION_ERROR';
          message = 'ข้อมูลที่ส่งมาไม่ถูกต้อง';
          details = rawMessage;
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
          error =
            typeof payload.error === 'string'
              ? payload.error
              : (HttpStatus[status] ?? 'Error');
          code =
            typeof payload.code === 'string'
              ? payload.code
              : defaultCodeForStatus(status);
        } else {
          message = exception.message;
          error = HttpStatus[status] ?? 'Error';
          code = defaultCodeForStatus(status);
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          code = 'DUPLICATE_RESOURCE';
          const rawTarget = exception.meta?.target;
          const target = Array.isArray(rawTarget)
            ? rawTarget
                .map((item) =>
                  typeof item === 'string' ? item : JSON.stringify(item),
                )
                .join(', ')
            : typeof rawTarget === 'string'
              ? rawTarget
              : '';
          message = target ? `ข้อมูลซ้ำในระบบ (${target})` : 'ข้อมูลซ้ำในระบบ';
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          code = 'FOREIGN_KEY_VIOLATION';
          const rawField = exception.meta?.field_name;
          const field = typeof rawField === 'string' ? rawField : null;
          message = field
            ? `ไม่พบข้อมูลอ้างอิงที่ระบุ (${field})`
            : 'ไม่พบข้อมูลอ้างอิงที่ระบุ';
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          code = 'RESOURCE_NOT_FOUND';
          message = 'ไม่พบข้อมูลที่ระบุในระบบ';
          break;
        }
        case 'P2039': {
          const constraint = extractConstraintName(
            exception.meta?.driverAdapterError,
          );
          if (constraint === 'subsidy_programs_date_overlap') {
            status = HttpStatus.CONFLICT;
            error = 'Conflict';
            code = 'ADMIN_PROGRAM_DATES_OVERLAP';
            message = 'ช่วงเวลาของโครงการซ้ำกับโครงการที่มีอยู่';
          } else {
            status = HttpStatus.BAD_REQUEST;
            error = 'Bad Request';
            code = 'DB_CONSTRAINT_VIOLATION';
            message = constraint
              ? `ข้อมูลไม่เป็นไปตามเงื่อนไขของระบบ (${constraint})`
              : 'ข้อมูลไม่เป็นไปตามเงื่อนไขของระบบ';
          }
          if (isDev) {
            details = exception.meta?.driverAdapterError;
          }
          break;
        }
        default: {
          status = HttpStatus.SERVICE_UNAVAILABLE;
          error = 'Database Error';
          code = `PRISMA_${exception.code}`;
          message = 'เกิดข้อผิดพลาดในการเข้าถึงฐานข้อมูล';
          if (isDev) {
            details = exception.meta;
          }
          break;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      code = 'PRISMA_VALIDATION_ERROR';
      message = isDev ? exception.message : 'ข้อมูลไม่ตรงกับโครงสร้างฐานข้อมูล';
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';
      code = 'INTERNAL_SERVER_ERROR';
      message = isDev ? exception.message : 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์';
      if (isDev) {
        details = { stack: exception.stack };
      }
    }

    const payload: ErrorResponseBody = {
      statusCode: status,
      error,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const messageStr = Array.isArray(message)
      ? message.join(', ')
      : String(message);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} ${status} - ${messageStr}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} ${status} [${code}] - ${messageStr}`,
      );
    }

    response.status(status).json(payload);
  }
}
