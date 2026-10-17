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
  PROGRAM_STATUSES,
  type AdminRoleStatus,
  type ProgramStatus,
} from '../admin.constants.js';

export class MerchantStatusActionDto {
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

  @IsDateString()
  startDate!: string;

  @IsDateString()
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
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
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
