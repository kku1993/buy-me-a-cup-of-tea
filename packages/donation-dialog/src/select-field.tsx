import { useId, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui";

export interface SelectFieldOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface SelectFieldProps {
  label: ReactNode;
  value: string;
  options: readonly SelectFieldOption[];
  onValueChange: (value: string) => void;
  contentClassName?: string;
  /** Optional non-selectable content rendered after the option group
   *  (e.g. a hint/CTA tied to a disabled option). */
  footer?: ReactNode;
}

/** A labelled, touch-friendly app select with a viewport-aware option list. */
export function SelectField({
  label,
  value,
  options,
  onValueChange,
  contentClassName,
  footer,
}: SelectFieldProps) {
  const labelId = useId();

  return (
    <div className="dd-field">
      <span id={labelId}>{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
          {footer ? (
            <div className="dd-select-field-footer">{footer}</div>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
