import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterMerchantDto } from './register.dto.js';

const validMerchantRegistration = {
  citizenId: '1100000000009',
  title: 'นาย',
  firstName: 'สมศักดิ์',
  lastName: 'รักไทย',
  birthDate: '1995-05-15',
  phone: '0812345678',
  homeNumber: '99/1',
  subdistrict: 'คลองเตย',
  district: 'คลองเตย',
  province: 'กรุงเทพมหานคร',
  postalCode: '10110',
  password: 'StrongPassword123!',
  acceptTerms: true,
  acceptPrivacy: true,
  merchantName: 'ร้านสมศักดิ์',
  merchantTypes: ['FOOD_BEVERAGE', 'OTOP'],
  merchantPhone: '0898765432',
  merchantDescription: 'อาหารและสินค้าในชุมชน',
  merchantAddress: '99/1 ถนนพระราม 4',
  merchantSubdistrict: 'คลองเตย',
  merchantDistrict: 'คลองเตย',
  merchantProvince: 'กรุงเทพมหานคร',
  merchantPostalCode: '10110',
  acceptMerchantTerms: true,
};

async function validateMerchant(merchantTypes: unknown) {
  return validate(
    plainToInstance(RegisterMerchantDto, {
      ...validMerchantRegistration,
      merchantTypes,
    }),
  );
}

describe('RegisterMerchantDto merchantTypes', () => {
  it('accepts multiple allow-listed business types', async () => {
    await expect(
      validateMerchant(['FOOD_BEVERAGE', 'OTOP']),
    ).resolves.toHaveLength(0);
  });

  it.each([
    ['empty', []],
    ['duplicate', ['OTOP', 'OTOP']],
    ['unknown', ['FOOD_BEVERAGE', 'UNSUPPORTED_TYPE']],
    ['not an array', 'FOOD_BEVERAGE'],
  ])('rejects %s merchantTypes', async (_label, merchantTypes) => {
    const errors = await validateMerchant(merchantTypes);
    expect(errors.some((error) => error.property === 'merchantTypes')).toBe(
      true,
    );
  });
});
