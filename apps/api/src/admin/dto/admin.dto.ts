import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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
  COUPON_DISCOUNT_TYPES,
  COUPON_STATUSES,
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

  @IsUUID('4')
  idempotencyKey!: string;
}

export class CreateAdminCouponDto {
  @IsUUID('4')
  idempotencyKey!: string;
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(150)
  couponName!: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
  @IsString()
  @IsIn(COUPON_DISCOUNT_TYPES)
  discountType!: (typeof COUPON_DISCOUNT_TYPES)[number];
  @IsString()
  @IsNotEmpty()
  discountValue!: string;
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  pointCost!: number;
  @IsOptional()
  @IsString()
  minPurchase?: string;
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays!: number;
  @IsOptional()
  @IsString()
  @IsIn(COUPON_STATUSES)
  status?: (typeof COUPON_STATUSES)[number];
}

export class UpdateAdminCouponDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(150)
  couponName!: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
  @IsString()
  @IsIn(COUPON_DISCOUNT_TYPES)
  discountType!: (typeof COUPON_DISCOUNT_TYPES)[number];
  @IsString()
  @IsNotEmpty()
  discountValue!: string;
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  pointCost!: number;
  @IsOptional()
  @IsString()
  minPurchase?: string;
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays!: number;
  @IsOptional()
  @IsString()
  @IsIn(COUPON_STATUSES)
  status?: (typeof COUPON_STATUSES)[number];
}
