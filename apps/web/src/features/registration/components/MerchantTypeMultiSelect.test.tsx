import type { MerchantBusinessType } from '@thai-please/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MerchantTypeMultiSelect } from './MerchantTypeMultiSelect';

const options = [
  { value: 'FOOD_BEVERAGE', label: 'ร้านอาหารและเครื่องดื่ม' },
  { value: 'OTOP', label: 'ร้าน OTOP' },
] satisfies Array<{ value: MerchantBusinessType; label: string }>;

function TestHarness() {
  const [selectedValues, setSelectedValues] = useState<MerchantBusinessType[]>(
    [],
  );
  return (
    <MerchantTypeMultiSelect
      options={options}
      selectedValues={selectedValues}
      placeholder="เลือกได้มากกว่าหนึ่งประเภท"
      groupLabel="ประเภทธุรกิจของร้านค้า"
      selectedCountText={(count) => `เลือกแล้ว ${count} ประเภท`}
      removeLabel={(label) => `นำ ${label} ออก`}
      hasError={false}
      onChange={setSelectedValues}
    />
  );
}

describe('MerchantTypeMultiSelect', () => {
  it('selects multiple values and removes a selected chip', () => {
    render(<TestHarness />);

    fireEvent.click(screen.getByText('เลือกได้มากกว่าหนึ่งประเภท'));
    fireEvent.click(screen.getByText('ร้านอาหารและเครื่องดื่ม'));
    fireEvent.click(screen.getByText('ร้าน OTOP'));

    expect(screen.getByText('เลือกแล้ว 2 ประเภท')).toBeInTheDocument();
    expect(screen.getByLabelText('ร้านอาหารและเครื่องดื่ม')).toBeChecked();
    expect(screen.getByLabelText('ร้าน OTOP')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'นำ ร้าน OTOP ออก' }));
    expect(screen.getByText('เลือกแล้ว 1 ประเภท')).toBeInTheDocument();
    expect(screen.getByLabelText('ร้าน OTOP')).not.toBeChecked();
  });
});
