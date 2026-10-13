export type RegistrationRole = 'consumer' | 'merchant';

export type RegistrationErrorCode =
  | 'required'
  | 'citizenId'
  | 'birthDate'
  | 'phone'
  | 'postalCode'
  | 'password'
  | 'confirmPassword'
  | 'taxId'
  | 'acceptTerms'
  | 'acceptPrivacy'
  | 'acceptMerchantTerms';

export type RegistrationErrors = Readonly<
  Partial<Record<string, RegistrationErrorCode>>
>;

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
const phonePattern = /^0\d{8,9}$/;
const postalCodePattern = /^\d{5}$/;
const numericIdPattern = /^\d{13}$/;

export function isValidThaiCitizenId(value: string) {
  if (!numericIdPattern.test(value)) {
    return false;
  }

  const digits = value.split('').map(Number);
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (13 - index), 0);
  const checkDigit = (11 - (sum % 11)) % 10;

  return checkDigit === digits[12];
}

function valueOf(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function isBlank(formData: FormData, field: string) {
  return valueOf(formData, field).length === 0;
}

export function validateRegistration(
  formData: FormData,
  role: RegistrationRole,
  today = new Date(),
): RegistrationErrors {
  const errors: Partial<Record<string, RegistrationErrorCode>> = {};
  const requiredIdentityFields = [
    'title',
    'firstName',
    'lastName',
    'birthDate',
    'phone',
  ];
  const requiredHomeAddressFields = [
    'homeNumber',
    'subdistrict',
    'district',
    'province',
    'postalCode',
  ];

  for (const field of [
    ...requiredIdentityFields,
    ...requiredHomeAddressFields,
  ]) {
    if (isBlank(formData, field)) {
      errors[field] = 'required';
    }
  }

  const citizenId = valueOf(formData, 'citizenId');
  if (!isValidThaiCitizenId(citizenId)) {
    errors.citizenId = 'citizenId';
  }

  const birthDate = valueOf(formData, 'birthDate');
  if (birthDate.length > 0) {
    const parsedBirthDate = new Date(`${birthDate}T00:00:00`);
    const todayAtMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    if (
      Number.isNaN(parsedBirthDate.getTime()) ||
      parsedBirthDate > todayAtMidnight
    ) {
      errors.birthDate = 'birthDate';
    }
  }

  if (!phonePattern.test(valueOf(formData, 'phone'))) {
    errors.phone = 'phone';
  }

  if (!postalCodePattern.test(valueOf(formData, 'postalCode'))) {
    errors.postalCode = 'postalCode';
  }

  const password = valueOf(formData, 'password');
  if (!passwordPattern.test(password) || password === citizenId) {
    errors.password = 'password';
  }

  if (valueOf(formData, 'confirmPassword') !== password) {
    errors.confirmPassword = 'confirmPassword';
  }

  if (formData.get('acceptTerms') !== 'on') {
    errors.acceptTerms = 'acceptTerms';
  }

  if (formData.get('acceptPrivacy') !== 'on') {
    errors.acceptPrivacy = 'acceptPrivacy';
  }

  if (role === 'merchant') {
    const requiredMerchantFields = [
      'merchantName',
      'merchantType',
      'merchantPhone',
      'merchantDescription',
      'merchantAddress',
      'merchantSubdistrict',
      'merchantDistrict',
      'merchantProvince',
      'merchantPostalCode',
    ];

    for (const field of requiredMerchantFields) {
      if (isBlank(formData, field)) {
        errors[field] = 'required';
      }
    }

    if (!phonePattern.test(valueOf(formData, 'merchantPhone'))) {
      errors.merchantPhone = 'phone';
    }

    if (!postalCodePattern.test(valueOf(formData, 'merchantPostalCode'))) {
      errors.merchantPostalCode = 'postalCode';
    }

    const taxId = valueOf(formData, 'taxId');
    if (taxId.length > 0 && !numericIdPattern.test(taxId)) {
      errors.taxId = 'taxId';
    }

    if (formData.get('acceptMerchantTerms') !== 'on') {
      errors.acceptMerchantTerms = 'acceptMerchantTerms';
    }
  }

  return errors;
}
