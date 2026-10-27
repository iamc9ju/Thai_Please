import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ADMIN_ROLE_STATUSES,
  MERCHANT_STATUSES,
  type MerchantStatus,
  PROGRAM_CURRENCIES,
  PROGRAM_STATUSES,
  PROGRAM_TIMEZONES,
  type AdminRoleStatus,
  type ProgramStatus,
} from '../admin.constants.js';

export class MerchantStatusActionDto {
  @IsOptional()
  @IsString()
  @IsIn(MERCHANT_STATUSES)
  expectedStatus?: MerchantStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateAdminRoleStatusDto {
  @IsString()
  @IsIn(ADMIN_ROLE_STATUSES)
  status!: AdminRoleStatus;
}

export class CreateSubsidyProgramDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  programName!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  initialGrant!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  subsidyPercentage!: number;

  @IsInt()
  @Min(1)
  @Max(50_000)
  dailySubsidyLimit!: number;

  @IsOptional()
  @IsString()
  @IsIn(PROGRAM_CURRENCIES)
  currency?: (typeof PROGRAM_CURRENCIES)[number];

  @IsOptional()
  @IsString()
  @IsIn(PROGRAM_TIMEZONES)
  timezone?: (typeof PROGRAM_TIMEZONES)[number];

  @IsDateString({ strict: true })
  startDate!: string;

  @IsDateString({ strict: true })
  endDate!: string;

  @IsOptional()
  @IsString()
  @IsIn(PROGRAM_STATUSES)
  status?: ProgramStatus;
}

export class UpdateSubsidyProgramDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  programName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  initialGrant?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  subsidyPercentage?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50_000)
  dailySubsidyLimit?: number;

  @IsOptional()
  @IsString()
  @IsIn(PROGRAM_CURRENCIES)
  currency?: (typeof PROGRAM_CURRENCIES)[number];

  @IsOptional()
  @IsString()
  @IsIn(PROGRAM_TIMEZONES)
  timezone?: (typeof PROGRAM_TIMEZONES)[number];

  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(PROGRAM_STATUSES)
  status?: ProgramStatus;
}

export class AdminGenerateQuestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(19)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey!: string;
}
