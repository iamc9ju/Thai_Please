import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { ThaiAddressCascadeFields } from './ThaiAddressCascadeFields';

afterEach(cleanup);

describe('ThaiAddressCascadeFields', () => {
  it('cascades province -> district -> subdistrict and auto-fills postal code', () => {
    const onClearFieldErrors = vi.fn();
    render(
      <ThaiAddressCascadeFields
        errors={{}}
        fieldNames={{
          province: 'province',
          district: 'district',
          subdistrict: 'subdistrict',
          postalCode: 'postalCode',
        }}
        onClearFieldErrors={onClearFieldErrors}
      />,
    );

    const provinceSelect = screen.getByLabelText(
      new RegExp(th.registration.fields.province),
    ) as HTMLSelectElement;
    const districtSelect = screen.getByLabelText(
      new RegExp(th.registration.fields.district),
    ) as HTMLSelectElement;
    const subdistrictSelect = screen.getByLabelText(
      new RegExp(th.registration.fields.subdistrict),
    ) as HTMLSelectElement;
    const postalCodeInput = screen.getByLabelText(
      new RegExp(th.registration.fields.postalCode),
    ) as HTMLInputElement;

    expect(districtSelect).toBeDisabled();
    expect(subdistrictSelect).toBeDisabled();
    expect(postalCodeInput.value).toBe('');

    // 1. Select Province: กาญจนบุรี
    fireEvent.change(provinceSelect, { target: { value: 'กาญจนบุรี' } });
    expect(districtSelect).not.toBeDisabled();
    expect(subdistrictSelect).toBeDisabled();

    // 2. Select District: สังขละบุรี
    fireEvent.change(districtSelect, { target: { value: 'สังขละบุรี' } });
    expect(subdistrictSelect).not.toBeDisabled();

    // 3. Select Subdistrict: หนองลู -> Auto-fills postal code 71240
    fireEvent.change(subdistrictSelect, { target: { value: 'หนองลู' } });
    expect(postalCodeInput.value).toBe('71240');

    // 4. Changing province resets district, subdistrict, and postalCode
    fireEvent.change(provinceSelect, { target: { value: 'กรุงเทพมหานคร' } });
    expect(districtSelect.value).toBe('');
    expect(subdistrictSelect.value).toBe('');
    expect(subdistrictSelect).toBeDisabled();
    expect(postalCodeInput.value).toBe('');
  });
});
