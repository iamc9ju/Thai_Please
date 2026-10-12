import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty() @IsInt() @Min(1) merchant_id!: number;
  @ApiProperty() @IsInt() @Min(1) category_id!: number;
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiProperty({ description: 'Integer Thai baht' })
  @IsInt()
  @Min(0)
  price!: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) category_id?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
