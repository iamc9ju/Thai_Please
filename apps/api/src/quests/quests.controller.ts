import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNumberString, IsUUID, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { parseCorsOrigins } from '../config/environment.js';
import { QuestsService } from './quests.service.js';

export const QUEST_ROUTES = {
  list: 'quests',
  generate: 'admin/quests/generate',
} as const;
const databaseId = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .max(19)
  .refine((id) => BigInt(id) <= 9223372036854775807n);
export class GenerateQuestDto {
  @ApiProperty({
    type: String,
    description: 'Target consumer public identifier',
    pattern: '^[1-9][0-9]*$',
  })
  @IsNumberString({ no_symbols: true })
  @MaxLength(19)
  userId = '';
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'UUID v4 idempotency key, reused on retry',
  })
  @IsUUID('4')
  idempotencyKey = '';
}

@ApiTags('quests')
@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class QuestsController {
  constructor(
    private readonly quests: QuestsService,
    private readonly config: ConfigService,
  ) {}

  @Get(QUEST_ROUTES.list)
  @Roles('CONSUMER')
  @ApiOperation({
    summary: 'Read own quest assignments with cursor pagination',
  })
  list(@Req() req: Request, @Query() query: Record<string, unknown>) {
    if (!req.user) throw new UnauthorizedException('QUEST_SESSION_REQUIRED');
    const parsed = z
      .strictObject({ cursor: databaseId.optional() })
      .safeParse(query);
    if (!parsed.success) throw new BadRequestException('QUEST_INVALID_QUERY');
    return this.quests.list(
      req.user.userId,
      parsed.data.cursor ? BigInt(parsed.data.cursor) : undefined,
    );
  }

  @Post(QUEST_ROUTES.generate)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Generate one automatically assigned quest for a consumer',
  })
  generate(@Req() req: Request, @Body() dto: GenerateQuestDto) {
    if (!req.user) throw new UnauthorizedException('QUEST_SESSION_REQUIRED');
    // Cookie-authenticated mutation: require explicit trusted browser origin and JSON.
    const origin = req.get('origin');
    if (
      !origin ||
      !parseCorsOrigins(
        this.config.getOrThrow<string>('CORS_ORIGINS'),
      ).includes(origin) ||
      !req.is('application/json')
    )
      throw new ForbiddenException('QUEST_ORIGIN_REJECTED');
    const parsed = databaseId.safeParse(dto.userId);
    if (!parsed.success) throw new BadRequestException('QUEST_INVALID_USER_ID');
    return this.quests.generate(
      BigInt(parsed.data),
      req.user.userId,
      dto.idempotencyKey,
    );
  }
}
