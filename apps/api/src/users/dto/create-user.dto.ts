import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ACTIVE_ROLES, type ActiveRole } from '../../auth/auth.types.js';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(13, 13, { message: 'Citizen ID must be exactly 13 digits' })
  @Matches(/^\d{13}$/, { message: 'Citizen ID must contain only digits' })
  citizenId!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsOptional()
  @IsIn(ACTIVE_ROLES)
  role?: ActiveRole;

  @IsString()
  @IsNotEmpty()
  @Length(8, 255)
  password!: string;
}
