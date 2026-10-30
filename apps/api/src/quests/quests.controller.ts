import {
  type ConsumerQuestCancellationPreview,
  type ConsumerQuestCancellationResponse,
  QUEST_CANCELLATION_PATH_SUFFIX,
  QUEST_CANCEL_PATH_SUFFIX,
} from '@thai-please/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiOkResponse,
  ApiAcceptedResponse,
} from '@nestjs/swagger';
import {
  IsNumberString,
  IsUUID,
  MaxLength,
  IsString,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { parseCorsOrigins } from '../config/environment.js';
import { QuestsService } from './quests.service.js';

export const QUEST_ROUTES = {
  list: 'quests',
  consumerList: 'consumer/quests',
  generate: 'admin/quests/generate',
  proposals: 'consumer/quests/proposals',
  select: 'consumer/quests/proposals/:requestKey/select',
  cancellation: `consumer/quests/:assignmentId/${QUEST_CANCELLATION_PATH_SUFFIX}`,
  cancel: `consumer/quests/:assignmentId/${QUEST_CANCEL_PATH_SUFFIX}`,
} as const;
const databaseId = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .max(19)
  .refine(
    (id) => /^[1-9][0-9]*$/.test(id) && BigInt(id) <= 9223372036854775807n,
  );
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

export class CreateProposalsDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  idempotencyKey = '';
}

export class SelectProposalDto extends CreateProposalsDto {
  @ApiProperty({ type: String, maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  proposalId = '';
}

export class CancelQuestDto {}

export class QuestProposalDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['MIN_SPEND', 'CATEGORY_SPEND'] }) type!: string;
  @ApiProperty({ type: String, nullable: true }) targetCategoryId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) targetCategoryName!:
    string | null;
  @ApiProperty({
    description: 'Personal contribution after discounts, decimal THB string',
  })
  minimumSpend!: string;
  @ApiProperty() rewardPoints!: number;
  @ApiProperty() durationDays!: number;
}

export class QuestProposalStateDto {
  @ApiProperty({ enum: ['READY', 'PENDING', 'COOLDOWN', 'ELIGIBLE', 'FAILED'] })
  status!: string;
  @ApiProperty({ type: String, nullable: true }) requestKey!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  expiresAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  nextEligibleAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
  @ApiProperty({ type: [QuestProposalDto] }) items!: QuestProposalDto[];
}

export class QuestSelectionResultDto {
  @ApiProperty() assignmentId!: string;
  @ApiProperty({ format: 'date-time' }) nextEligibleAt!: string;
}

export class QuestCancellationPreviewDto implements ConsumerQuestCancellationPreview {
  @ApiProperty() assignmentId!: string;
  @ApiProperty({ format: 'date-time' }) nextEligibleAt!: string;
}

export class QuestCancellationResultDto
  extends QuestCancellationPreviewDto
  implements ConsumerQuestCancellationResponse
{
  @ApiProperty({ enum: ['CANCELLED'] }) status!: 'CANCELLED';
}

@ApiTags('quests')
@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class QuestsController {
  constructor(
    private readonly quests: QuestsService,
    private readonly config: ConfigService,
  ) {}

  private requireMutationOrigin(req: Request) {
    const origin = req.get('origin');
    if (
      !origin ||
      !parseCorsOrigins(
        this.config.getOrThrow<string>('CORS_ORIGINS'),
      ).includes(origin) ||
      !req.is('application/json')
    )
      throw new ForbiddenException('QUEST_ORIGIN_REJECTED');
  }

  @Get(QUEST_ROUTES.proposals)
  @Roles('CONSUMER')
  @ApiOperation({
    summary:
      'Read own proposal set and next entitlement time; does not generate',
  })
  @ApiOkResponse({ type: QuestProposalStateDto })
  proposals(@Req() req: Request, @Query() query: Record<string, unknown>) {
    if (!req.user) throw new UnauthorizedException('QUEST_SESSION_REQUIRED');
    if (!z.strictObject({}).safeParse(query).success)
      throw new BadRequestException('QUEST_INVALID_QUERY');
    return this.quests.proposals(req.user.userId);
  }

  @Post(QUEST_ROUTES.proposals)
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('CONSUMER')
  @ApiOperation({
    summary:
      'Queue a durable AI proposal generation job for the session consumer',
  })
  @ApiAcceptedResponse({ type: QuestProposalStateDto })
  createProposals(@Req() req: Request, @Body() dto: CreateProposalsDto) {
    if (!req.user) throw new UnauthorizedException('QUEST_SESSION_REQUIRED');
    this.requireMutationOrigin(req);
    return this.quests.generate(
      req.user.userId,
      req.user.userId,
      dto.idempotencyKey,
    );
  }

  @Post(QUEST_ROUTES.select)
  @HttpCode(HttpStatus.OK)
  @Roles('CONSUMER')
  @ApiOperation({
    summary:
      'Select exactly one validated proposal; starts the seven-day cycle',
  })
  @ApiOkResponse({ type: QuestSelectionResultDto })
  select(
    @Req() req: Request,
    @Param('requestKey') key: string,
    @Body() dto: SelectProposalDto,
  ) {
    if (!req.user) throw new UnauthorizedException('QUEST_SESSION_REQUIRED');
    this.requireMutationOrigin(req);
    if (!z.uuidv4().safeParse(key).success)
      throw new BadRequestException('QUEST_INVALID_REQUEST_KEY');
    return this.quests.select(
      req.user.userId,
      key,
      dto.proposalId,
      dto.idempotencyKey,
    );
  }

  @Get(QUEST_ROUTES.cancellation)
  @Roles('CONSUMER')
  @ApiOperation({
    summary: 'Preview cancellation and the unchanged next entitlement time',
  })
  @ApiOkResponse({ type: QuestCancellationPreviewDto })
  cancellationPreview(
    @Req() req: Request,
    @Param('assignmentId') assignmentId: string,
    @Query() query: Record<string, unknown>,
  ) {
    if (!req.user) throw new UnauthorizedException('QUEST_SESSION_REQUIRED');
    if (!z.strictObject({}).safeParse(query).success)
      throw new BadRequestException('QUEST_INVALID_QUERY');
    const parsed = databaseId.safeParse(assignmentId);
    if (!parsed.success)
      throw new BadRequestException('QUEST_INVALID_ASSIGNMENT_ID');
    return this.quests.cancellationPreview(
      req.user.userId,
      BigInt(parsed.data),
    );
  }

  @Post(QUEST_ROUTES.cancel)
  @HttpCode(HttpStatus.OK)
  @Roles('CONSUMER')
  @ApiOperation({
    summary:
      'Cancel an active assignment without restarting or refunding its seven-day cycle',
  })
  @ApiOkResponse({ type: QuestCancellationResultDto })
  cancel(
    @Req() req: Request,
    @Param('assignmentId') assignmentId: string,
    @Body() _dto: CancelQuestDto,
  ) {
    if (!req.user) throw new UnauthorizedException('QUEST_SESSION_REQUIRED');
    this.requireMutationOrigin(req);
    if (!z.strictObject({}).safeParse(_dto).success)
      throw new BadRequestException('QUEST_INVALID_CANCELLATION_BODY');
    const parsed = databaseId.safeParse(assignmentId);
    if (!parsed.success)
      throw new BadRequestException('QUEST_INVALID_ASSIGNMENT_ID');
    return this.quests.cancel(req.user.userId, BigInt(parsed.data));
  }

  @Get([QUEST_ROUTES.list, QUEST_ROUTES.consumerList])
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
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('ADMIN')
  @ApiAcceptedResponse({ type: QuestProposalStateDto })
  @ApiOperation({
    summary:
      'Queue proposals for a consumer; does not automatically assign a quest',
  })
  generate(@Req() req: Request, @Body() dto: GenerateQuestDto) {
    if (!req.user) throw new UnauthorizedException('QUEST_SESSION_REQUIRED');
    this.requireMutationOrigin(req);
    const parsed = databaseId.safeParse(dto.userId);
    if (!parsed.success) throw new BadRequestException('QUEST_INVALID_USER_ID');
    return this.quests.generate(
      BigInt(parsed.data),
      req.user.userId,
      dto.idempotencyKey,
    );
  }
}
