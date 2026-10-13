import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RegisterConsumerDto {
  @IsString()
  @IsNotEmpty()
  @Length(13, 13, { message: 'เลขประจำตัวประชาชนต้องมี 13 หลัก' })
  citizenId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  birthDate!: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  @Matches(/^0\d{8,9}$/, { message: 'เบอร์โทรศัพท์ไม่ถูกต้อง' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  homeNumber!: string;

  @IsString()
  @IsOptional()
  village?: string;

  @IsString()
  @IsOptional()
  building?: string;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  alley?: string;

  @IsString()
  @IsOptional()
  road?: string;

  @IsString()
  @IsNotEmpty()
  subdistrict!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 5, { message: 'รหัสไปรษณีย์ต้องมี 5 หลัก' })
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 255, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  password!: string;

  @IsBoolean()
  acceptTerms!: boolean;

  @IsBoolean()
  acceptPrivacy!: boolean;
}

export class RegisterMerchantDto extends RegisterConsumerDto {
  @IsString()
  @IsNotEmpty()
  merchantName!: string;

  @IsString()
  @IsNotEmpty()
  merchantType!: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0\d{8,9}$/, { message: 'เบอร์โทรศัพท์ร้านค้าไม่ถูกต้อง' })
  merchantPhone!: string;

  @IsString()
  @IsNotEmpty()
  merchantDescription!: string;

  @IsString()
  @IsNotEmpty()
  merchantAddress!: string;

  @IsString()
  @IsNotEmpty()
  merchantSubdistrict!: string;

  @IsString()
  @IsNotEmpty()
  merchantDistrict!: string;

  @IsString()
  @IsNotEmpty()
  merchantProvince!: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 5, { message: 'รหัสไปรษณีย์ร้านค้าต้องมี 5 หลัก' })
  merchantPostalCode!: string;

  @IsBoolean()
  acceptMerchantTerms!: boolean;
}
