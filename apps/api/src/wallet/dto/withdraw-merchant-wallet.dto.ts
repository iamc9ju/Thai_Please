import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WITHDRAWAL_LIMITS } from '../wallet.constants.js';

export class WithdrawMerchantWalletDto {
  @IsInt({ message: 'จำนวนเงินที่ถอนต้องเป็นจำนวนเต็มบาท' })
  @Min(WITHDRAWAL_LIMITS.MIN_AMOUNT, {
    message: 'จำนวนเงินที่ถอนต้องมีค่าอย่างน้อย 1 บาท',
  })
  @Max(WITHDRAWAL_LIMITS.MAX_AMOUNT, {
    message: 'จำนวนเงินที่ถอนต้องไม่เกิน 500,000 บาทต่อรายการ',
  })
  amount!: number;

  @IsString({ message: 'ต้องระบุ Idempotency Key' })
  @IsNotEmpty({ message: 'Idempotency Key ห้ามว่าง' })
  @MinLength(WITHDRAWAL_LIMITS.IDEMPOTENCY_KEY_MIN_LENGTH, {
    message: 'Idempotency Key ต้องมีความยาวอย่างน้อย 8 ตัวอักษร',
  })
  @MaxLength(WITHDRAWAL_LIMITS.IDEMPOTENCY_KEY_MAX_LENGTH, {
    message: 'Idempotency Key ต้องมีความยาวไม่เกิน 128 ตัวอักษร',
  })
  idempotencyKey!: string;
}
