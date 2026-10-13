import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumberString,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  productId!: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

/**
 * FR-M02: Merchant สร้าง Order พร้อม QR Token
 */
export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  /** Optional: user_coupon_id ที่ consumer เลือกใช้ */
  @IsOptional()
  @IsNumberString({ no_symbols: true })
  @MaxLength(40)
  userCouponId?: string;
}

/**
 * FR-C04: Consumer ยืนยันและชำระเงินผ่าน QR Token
 */
export class PayByQrDto {
  @IsString()
  @MaxLength(255)
  qrToken!: string;

  @IsOptional()
  @IsString()
  @Length(64, 64)
  confirmationToken?: string;

  /** Optional: user_coupon_id ที่ consumer เลือกใช้ตอน scan */
  @IsOptional()
  @IsNumberString({ no_symbols: true })
  @MaxLength(40)
  userCouponId?: string;
}

/**
 * DTO ที่ Consumer ใช้ preview ข้อมูล order ก่อนจ่ายเงิน
 */
export class PreviewOrderDto {
  @IsString()
  @MaxLength(255)
  qrToken!: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  @MaxLength(40)
  userCouponId?: string;
}
