import { describe, expect, it } from 'vitest';
import {
  isValidThaiCitizenId,
  validateRegistration,
} from './registration.validation';

function createValidConsumerFormData() {
  const formData = new FormData();
  const fields = {
    citizenId: '1101700203450',
    title: 'นาย',
    firstName: 'สมชาย',
    lastName: 'ใจดี',
    birthDate: '1990-01-15',
    phone: '0812345678',
    homeNumber: '99/1',
    subdistrict: 'บางรัก',
    district: 'บางรัก',
    province: 'กรุงเทพมหานคร',
    postalCode: '10500',
    password: 'ThaiPlease@2026',
    confirmPassword: 'ThaiPlease@2026',
    acceptTerms: 'on',
    acceptPrivacy: 'on',
  } as const;

  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }

  return formData;
}

describe('registration validation', () => {
  it('validates a Thai citizen ID check digit', () => {
    expect(isValidThaiCitizenId('1101700203450')).toBe(true);
    expect(isValidThaiCitizenId('1101700203451')).toBe(false);
    expect(isValidThaiCitizenId('123')).toBe(false);
  });

  it('accepts complete consumer registration data', () => {
    const errors = validateRegistration(
      createValidConsumerFormData(),
      'consumer',
      new Date('2026-10-13T12:00:00+07:00'),
    );

    expect(errors).toEqual({});
  });

  it('rejects future birth date, weak password and missing consent', () => {
    const formData = createValidConsumerFormData();
    formData.set('birthDate', '2027-01-01');
    formData.set('password', 'password');
    formData.set('confirmPassword', 'different');
    formData.delete('acceptPrivacy');

    const errors = validateRegistration(
      formData,
      'consumer',
      new Date('2026-10-13T12:00:00+07:00'),
    );

    expect(errors.birthDate).toBe('birthDate');
    expect(errors.password).toBe('password');
    expect(errors.confirmPassword).toBe('confirmPassword');
    expect(errors.acceptPrivacy).toBe('acceptPrivacy');
  });

  it('requires merchant details and merchant consent', () => {
    const errors = validateRegistration(
      createValidConsumerFormData(),
      'merchant',
      new Date('2026-10-13T12:00:00+07:00'),
    );

    expect(errors.merchantName).toBe('required');
    expect(errors.merchantPhone).toBe('phone');
    expect(errors.acceptMerchantTerms).toBe('acceptMerchantTerms');
  });
});
