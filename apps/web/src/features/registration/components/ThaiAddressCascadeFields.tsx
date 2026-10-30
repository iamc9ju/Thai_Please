import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { th } from '../../../i18n/th';
import {
  THAI_PROVINCES,
  getDistrictsByProvince,
  getPostalCodeForSubdistrict,
  getSubdistrictsByDistrict,
} from '../data/thai-address';
import type { RegistrationErrors } from '../registration.validation';
import { RegistrationField as Field } from './RegistrationField';

type AddressFieldNames = Readonly<{
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
}>;

type ThaiAddressCascadeFieldsProps = Readonly<{
  fieldNames: AddressFieldNames;
  errors: RegistrationErrors;
  onClearFieldErrors?: (fields: string[]) => void;
}>;

function getAccessibilityProps(name: string, errors: RegistrationErrors) {
  const hasError = Boolean(errors[name]);

  return {
    'aria-describedby': hasError ? `${name}-error` : undefined,
    'aria-invalid': hasError,
  } as const;
}

export function ThaiAddressCascadeFields({
  fieldNames,
  errors,
  onClearFieldErrors,
}: ThaiAddressCascadeFieldsProps) {
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const districts = getDistrictsByProvince(province);
  const subdistricts = getSubdistrictsByDistrict(province, district);

  const handleProvinceChange = (nextProvince: string) => {
    setProvince(nextProvince);
    setDistrict('');
    setSubdistrict('');
    setPostalCode('');
    onClearFieldErrors?.([fieldNames.province]);
  };

  const handleDistrictChange = (nextDistrict: string) => {
    setDistrict(nextDistrict);
    setSubdistrict('');
    setPostalCode('');
    onClearFieldErrors?.([fieldNames.district]);
  };

  const handleSubdistrictChange = (nextSubdistrict: string) => {
    setSubdistrict(nextSubdistrict);
    const nextPostalCode = nextSubdistrict
      ? getPostalCodeForSubdistrict(province, district, nextSubdistrict)
      : '';
    setPostalCode(nextPostalCode);
    onClearFieldErrors?.([fieldNames.subdistrict, fieldNames.postalCode]);
  };

  return (
    <>
      <Field
        error={errors[fieldNames.province]}
        label={th.registration.fields.province}
        name={fieldNames.province}
      >
        <div className="relative">
          <select
            {...getAccessibilityProps(fieldNames.province, errors)}
            id={fieldNames.province}
            name={fieldNames.province}
            value={province}
            onChange={(event) => handleProvinceChange(event.currentTarget.value)}
            className="w-full appearance-none pr-10"
          >
            <option value="">{th.registration.placeholders.selectProvince}</option>
            {THAI_PROVINCES.map((provName) => (
              <option key={provName} value={provName}>
                {provName}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
          />
        </div>
      </Field>

      <Field
        error={errors[fieldNames.district]}
        label={th.registration.fields.district}
        name={fieldNames.district}
      >
        <div className="relative">
          <select
            {...getAccessibilityProps(fieldNames.district, errors)}
            id={fieldNames.district}
            name={fieldNames.district}
            value={district}
            disabled={!province}
            onChange={(event) => handleDistrictChange(event.currentTarget.value)}
            className="w-full appearance-none pr-10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <option value="">
              {province
                ? th.registration.placeholders.selectDistrict
                : th.registration.placeholders.selectDistrictDisabled}
            </option>
            {districts.map((distName) => (
              <option key={distName} value={distName}>
                {distName}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
          />
        </div>
      </Field>

      <Field
        error={errors[fieldNames.subdistrict]}
        label={th.registration.fields.subdistrict}
        name={fieldNames.subdistrict}
      >
        <div className="relative">
          <select
            {...getAccessibilityProps(fieldNames.subdistrict, errors)}
            id={fieldNames.subdistrict}
            name={fieldNames.subdistrict}
            value={subdistrict}
            disabled={!district}
            onChange={(event) =>
              handleSubdistrictChange(event.currentTarget.value)
            }
            className="w-full appearance-none pr-10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <option value="">
              {district
                ? th.registration.placeholders.selectSubdistrict
                : th.registration.placeholders.selectSubdistrictDisabled}
            </option>
            {subdistricts.map((subItem) => (
              <option key={subItem.name} value={subItem.name}>
                {subItem.name}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
          />
        </div>
      </Field>

      <Field
        error={errors[fieldNames.postalCode]}
        label={th.registration.fields.postalCode}
        name={fieldNames.postalCode}
      >
        <input
          {...getAccessibilityProps(fieldNames.postalCode, errors)}
          autoComplete="postal-code"
          id={fieldNames.postalCode}
          name={fieldNames.postalCode}
          value={postalCode}
          readOnly
          placeholder={th.registration.placeholders.autoPostalCode}
          className="bg-slate-50/90 text-slate-800 font-semibold cursor-default"
        />
      </Field>
    </>
  );
}
