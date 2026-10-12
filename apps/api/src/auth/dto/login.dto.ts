import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '1101700203451', pattern: '^\\d{13}$' })
  @IsString()
  @Matches(/^\d{13}$/)
  citizen_id!: string;
}

export class LoginResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty({ example: 'Bearer' })
  token_type!: string;

  @ApiProperty({ format: 'date-time' })
  expires_at!: string;

  @ApiProperty()
  user!: { id: number; display_name: string; role: string };
}
