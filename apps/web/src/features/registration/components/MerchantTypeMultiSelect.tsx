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
    <div className="registration-multi-select relative">
      <details className="group">
        <summary
          id="merchantTypes"
          aria-labelledby="merchantTypes-label"
          aria-describedby={hasError ? 'merchantTypes-error' : undefined}
          aria-invalid={hasError}
          className="flex min-h-[2.85rem] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 cursor-pointer list-none transition-all focus-visible:border-[#0056b3] focus-visible:ring-2 focus-visible:ring-[#0056b3]/15"
        >
          <span
            className={
              selectedOptions.length > 0 ? 'text-slate-900 font-medium' : 'text-slate-400'
            }
          >
            {selectedOptions.length > 0
              ? selectedCountText(selectedOptions.length)
              : placeholder}
          </span>
          <ChevronDown
            className="size-4 text-slate-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div
          className="registration-multi-select-menu absolute z-30 mt-1.5 left-0 right-0 grid max-h-64 overflow-y-auto gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
          role="group"
          aria-label={groupLabel}
        >
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 hover:bg-blue-50/70 cursor-pointer"
              >
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
                <strong className="font-semibold text-slate-800">
                  {option.label}
                </strong>
              </label>
            );
          })}
        </div>
      </details>
      {selectedOptions.length > 0 ? (
        <div className="registration-selected-types mt-2 flex flex-wrap gap-1.5" aria-live="polite">
          {selectedOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => toggleValue(option.value)}
              aria-label={removeLabel(option.label)}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-[#0056b3] hover:bg-blue-100 transition-colors cursor-pointer"
            >
              {option.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
