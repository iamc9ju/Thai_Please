import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TOPUP_LIMITS } from '../wallet.constants.js';

export class TopUpDto {
  @IsInt({ message: 'จำนวนเงินต้องเป็นจำนวนเต็ม' })
  @Min(TOPUP_LIMITS.MIN_AMOUNT, {
    message: `จำนวนเงินขั้นต่ำคือ ${TOPUP_LIMITS.MIN_AMOUNT} บาท`,
  })
  @Max(TOPUP_LIMITS.MAX_AMOUNT, {
    message: `จำนวนเงินสูงสุดคือ ${TOPUP_LIMITS.MAX_AMOUNT} บาท`,
  })
  amount!: number;

  @IsString({ message: 'idempotencyKey ต้องเป็นข้อความ' })
  @IsNotEmpty({ message: 'กรุณาระบุ idempotencyKey' })
  @MinLength(TOPUP_LIMITS.IDEMPOTENCY_KEY_MIN_LENGTH, {
    message: `idempotencyKey ต้องมีความยาวอย่างน้อย ${TOPUP_LIMITS.IDEMPOTENCY_KEY_MIN_LENGTH} ตัวอักษร`,
  })
  @MaxLength(TOPUP_LIMITS.IDEMPOTENCY_KEY_MAX_LENGTH, {
    message: `idempotencyKey ต้องมีความยาวไม่เกิน ${TOPUP_LIMITS.IDEMPOTENCY_KEY_MAX_LENGTH} ตัวอักษร`,
  })
  idempotencyKey!: string;
}
