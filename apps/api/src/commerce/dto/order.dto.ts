import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty() @IsInt() @Min(1) merchant_id!: number;
}

export class AddOrderItemDto {
  @ApiProperty() @IsInt() @Min(1) product_id!: number;
  @ApiProperty() @IsInt() @Min(1) quantity!: number;
}

export class ApplyCouponDto {
  @ApiProperty() @IsInt() @Min(1) user_coupon_id!: number;
  @ApiProperty() @IsString() qr_token!: string;
}

export class PayOrderDto {
  @ApiProperty() @IsString() qr_token!: string;
}
