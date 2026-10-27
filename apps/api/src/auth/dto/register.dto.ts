import {
  IsBoolean,
  Equals,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterConsumerDto {
  @IsString()
  @IsNotEmpty()
  @Length(13, 13, { message: 'เลขประจำตัวประชาชนต้องมี 13 หลัก' })
  @Matches(/^\d{13}$/, { message: 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก' })
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

  @IsDateString({ strict: true })
  birthDate!: string;

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
  @Matches(/^\d{5}$/, { message: 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก' })
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 255, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  password!: string;

  @IsBoolean()
  @Equals(true, { message: 'กรุณายอมรับข้อกำหนดการใช้งาน' })
  acceptTerms!: boolean;

  @IsBoolean()
  @Equals(true, { message: 'กรุณารับทราบนโยบายความเป็นส่วนตัว' })
  acceptPrivacy!: boolean;
}

export class RegisterMerchantDto extends RegisterConsumerDto {
  @IsString()
  @IsNotEmpty()
  merchantName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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
  @Matches(/^\d{5}$/, {
    message: 'รหัสไปรษณีย์ร้านค้าต้องเป็นตัวเลข 5 หลัก',
  })
  merchantPostalCode!: string;

  @IsBoolean()
  @Equals(true, { message: 'กรุณายอมรับข้อกำหนดสำหรับร้านค้า' })
  acceptMerchantTerms!: boolean;
}
