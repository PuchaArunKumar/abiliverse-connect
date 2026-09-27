import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption<V extends string> {
  value: V;
  label: string;
}

interface FilterRadioGroupProps<V extends string> {
  /** Names the group for everyone, e.g. "Show". */
  legend: string;
  /** The radios' shared name attribute; must be unique on the page. */
  name: string;
  value: V;
  options: readonly FilterOption<V>[];
  onChange: (value: V) => void;
  className?: string;
}

/**
 * A row of mutually exclusive filter buttons built from native radios.
 *
 * It replaces a Radix tab list that had no tab panels: every tab pointed
 * aria-controls at an element that did not exist, and "tab" promises a panel
 * that never appears. A fieldset of radios says exactly what this is (pick
 * one), works with arrow keys and forced-colors mode without any ARIA, and
 * the check mark shows the selection without relying on colour alone.
 */
const FilterRadioGroup = <V extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  className,
}: FilterRadioGroupProps<V>) => (
  <fieldset className={className}>
    <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition-colors motion-reduce:transition-none",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
              checked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {checked && <Check className="h-4 w-4" aria-hidden="true" />}
            {option.label}
          </label>
        );
      })}
    </div>
  </fieldset>
);

export default FilterRadioGroup;
