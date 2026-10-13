import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(13, 13, { message: 'เลขประจำตัวประชาชนต้องมี 13 หลัก' })
  citizenId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  password!: string;
}
