import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let mockRequest: { url: string; method: string };
  let mockHost: {
    switchToHttp: () => {
      getResponse: () => typeof mockResponse;
      getRequest: () => typeof mockRequest;
    };
  };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockJson = vi.fn();
    mockStatus = vi.fn().mockImplementation(() => ({ json: mockJson }));
    mockResponse = { status: mockStatus, json: mockJson };
    mockRequest = { url: '/api/v1/test', method: 'POST' };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('formats standard HttpException with string message', () => {
    const exception = new NotFoundException('ไม่พบข้อมูลที่ระบุ');

    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        code: 'NOT_FOUND',
        message: 'ไม่พบข้อมูลที่ระบุ',
        path: '/api/v1/test',
        timestamp: expect.any(String),
      }),
    );
  });

  it('formats ValidationPipe error array with details', () => {
    const exception = new BadRequestException({
      message: ['items.0.productId must be an integer number'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
        details: ['items.0.productId must be an integer number'],
        path: '/api/v1/test',
      }),
    );
  });

  it('maps Prisma P2002 unique constraint error to 409 Conflict', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Unique error', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: { target: ['citizen_id'] },
    });

    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'DUPLICATE_RESOURCE',
        message: 'ข้อมูลซ้ำในระบบ (citizen_id)',
        path: '/api/v1/test',
      }),
    );
  });

  it('maps Prisma P2003 foreign key violation to 400 Bad Request', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Foreign key error',
      {
        code: 'P2003',
        clientVersion: '7.10.0',
        meta: { field_name: 'product_id' },
      },
    );

    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'ไม่พบข้อมูลอ้างอิงที่ระบุ (product_id)',
        path: '/api/v1/test',
      }),
    );
  });

  it('maps Prisma P2025 record not found to 404 Not Found', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      {
        code: 'P2025',
        clientVersion: '7.10.0',
      },
    );

    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        code: 'RESOURCE_NOT_FOUND',
        message: 'ไม่พบข้อมูลที่ระบุในระบบ',
      }),
    );
  });

  it('maps Prisma P2039 check constraint violation to 400 Bad Request with constraint name', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Check constraint error',
      {
        code: 'P2039',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            originalMessage:
              'new row for relation "orders" violates check constraint "orders_check1"',
          },
        },
      },
    );

    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'DB_CONSTRAINT_VIOLATION',
        message: 'ข้อมูลไม่เป็นไปตามเงื่อนไขของระบบ (orders_check1)',
      }),
    );
  });

  it('maps the subsidy-program date overlap trigger to a localized conflict', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Overlapping date range',
      {
        code: 'P2039',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            originalMessage:
              'violates exclusion constraint "subsidy_programs_date_overlap"',
          },
        },
      },
    );

    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ADMIN_PROGRAM_DATES_OVERLAP',
        message: 'ช่วงเวลาของโครงการซ้ำกับโครงการที่มีอยู่',
      }),
    );
  });

  it('maps unhandled generic Error to 500 Internal Server Error', () => {
    const exception = new Error('Unexpected crash');

    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        code: 'INTERNAL_SERVER_ERROR',
        path: '/api/v1/test',
      }),
    );
  });
});
