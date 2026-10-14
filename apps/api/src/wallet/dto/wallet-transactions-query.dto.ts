import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { WALLET_TRANSACTION_PAGE_LIMITS } from '../wallet.constants.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OPAQUE_CURSOR_PATTERN = /^[A-Za-z0-9_-]+$/;

@ValidatorConstraint({ name: 'dateToNotBeforeDateFrom', async: false })
class DateToNotBeforeDateFromConstraint implements ValidatorConstraintInterface {
  validate(dateTo: unknown, args: ValidationArguments): boolean {
    if (dateTo === undefined) {
      return true;
    }

    const query = args.object as WalletTransactionsQueryDto;
    return (
      typeof dateTo === 'string' &&
      (query.dateFrom === undefined || query.dateFrom <= dateTo)
    );
  }

  defaultMessage(): string {
    return 'dateTo ต้องไม่อยู่ก่อน dateFrom';
  }
}

export class WalletTransactionsQueryDto {
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'dateFrom ต้องเป็น YYYY-MM-DD' })
  @IsDateString({ strict: true, strictSeparator: true })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'dateTo ต้องเป็น YYYY-MM-DD' })
  @IsDateString({ strict: true, strictSeparator: true })
  @Validate(DateToNotBeforeDateFromConstraint)
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(WALLET_TRANSACTION_PAGE_LIMITS.MAX)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(OPAQUE_CURSOR_PATTERN, { message: 'cursor ไม่ถูกต้อง' })
  cursor?: string;
}
