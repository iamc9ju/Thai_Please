import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  IsPositive,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type ProductStatusValue = (typeof PRODUCT_STATUSES)[number];

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  categoryName!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateProductDto {
  @IsString()
  @MaxLength(150)
  productName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  @Type(() => Number)
  price!: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  categoryId!: number;

  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  productName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @IsString()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatusValue;

  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;
}

export class UpdateProductStatusDto {
  @IsString()
  @IsIn(PRODUCT_STATUSES)
  status!: ProductStatusValue;
}

export class UploadProductImageDto {
  @IsString()
  dataUrl!: string;
}
