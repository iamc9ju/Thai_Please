import { describe, expect, it } from 'vitest';
import {
  getBangkokDateInputValue,
  isValidBirthDate,
  validateRegistration,
} from './registration.validation';

function createValidMerchantFormData(): FormData {
  const formData = new FormData();
  const values = {
    citizenId: '1100000000008',
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
    confirmPassword: 'StrongPassword123!',
    acceptTerms: 'on',
    acceptPrivacy: 'on',
    merchantName: 'ร้านสมศักดิ์',
    merchantPhone: '0898765432',
    merchantDescription: 'อาหารและสินค้าในชุมชน',
    merchantAddress: '99/1 ถนนพระราม 4',
    merchantSubdistrict: 'คลองเตย',
    merchantDistrict: 'คลองเตย',
    merchantProvince: 'กรุงเทพมหานคร',
    merchantPostalCode: '10110',
    acceptMerchantTerms: 'on',
  };
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe('birth date validation', () => {
  const today = new Date('2026-10-14T03:00:00.000Z');

  it('uses the Asia/Bangkok calendar date for the picker maximum', () => {
    expect(getBangkokDateInputValue(today)).toBe('2026-10-14');
  });

  it('accepts a real date that is not in the future', () => {
    expect(isValidBirthDate('2000-02-29', today)).toBe(true);
    expect(isValidBirthDate('2026-10-14', today)).toBe(true);
  });

  it('rejects an impossible date and a future date', () => {
    expect(isValidBirthDate('2026-02-30', today)).toBe(false);
    expect(isValidBirthDate('2026-10-15', today)).toBe(false);
  });
});

describe('merchant business type validation', () => {
  it('accepts multiple selected merchant types', () => {
    const formData = createValidMerchantFormData();
    formData.append('merchantTypes', 'FOOD_BEVERAGE');
    formData.append('merchantTypes', 'OTOP');

    expect(
      validateRegistration(
        formData,
        'merchant',
        new Date('2026-10-28T03:00:00.000Z'),
      ),
    ).toEqual({});
  });

  it('requires at least one merchant type', () => {
    const formData = createValidMerchantFormData();

    expect(
      validateRegistration(
        formData,
        'merchant',
        new Date('2026-10-28T03:00:00.000Z'),
      ),
    ).toMatchObject({ merchantTypes: 'required' });
  });
});
