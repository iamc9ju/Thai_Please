import type { MerchantBusinessType } from '@thai-please/contracts';
import { Check, ChevronDown } from 'lucide-react';

type MerchantTypeOption = Readonly<{
  value: MerchantBusinessType;
  label: string;
}>;

type MerchantTypeMultiSelectProps = Readonly<{
  options: readonly MerchantTypeOption[];
  selectedValues: readonly MerchantBusinessType[];
  placeholder: string;
  groupLabel: string;
  selectedCountText: (count: number) => string;
  removeLabel: (label: string) => string;
  hasError: boolean;
  onChange: (values: MerchantBusinessType[]) => void;
}>;

export function MerchantTypeMultiSelect({
  options,
  selectedValues,
  placeholder,
  groupLabel,
  selectedCountText,
  removeLabel,
  hasError,
  onChange,
}: MerchantTypeMultiSelectProps) {
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );

  const toggleValue = (value: MerchantBusinessType) => {
    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((current) => current !== value)
        : [...selectedValues, value],
    );
  };

  return (
    <div className="registration-multi-select">
      <details>
        <summary
          id="merchantTypes"
          aria-labelledby="merchantTypes-label"
          aria-describedby={hasError ? 'merchantTypes-error' : undefined}
          aria-invalid={hasError}
        >
          <span>
            {selectedOptions.length > 0
              ? selectedCountText(selectedOptions.length)
              : placeholder}
          </span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div
          className="registration-multi-select-menu"
          role="group"
          aria-label={groupLabel}
        >
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <label key={option.value}>
                <input
                  type="checkbox"
                  name="merchantTypes"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => toggleValue(option.value)}
                />
                <span aria-hidden="true" className="registration-option-check">
                  {isSelected ? <Check /> : null}
                </span>
                <strong>{option.label}</strong>
              </label>
            );
          })}
        </div>
      </details>
      {selectedOptions.length > 0 ? (
        <div className="registration-selected-types" aria-live="polite">
          {selectedOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => toggleValue(option.value)}
              aria-label={removeLabel(option.label)}
            >
              {option.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
