"use client";

import { useId, useState } from "react";
import Input from "./Input";
import { formatAmount, parseAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PriceInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  /** Original price — shown as a temporary hint beside the label while typing a new value. */
  previousValue?: number | null;
  currency?: string;
  className?: string;
  wrapperClassName?: string;
}

/**
 * Number input for prices. Displays the value comma-grouped with 3 decimals
 * ("1,234.500") while idle, and switches to a plain editable number while
 * focused. While the edited value differs from the previous price, a small
 * "Old: X" hint appears on the label line (right-aligned) so the old price
 * can be referenced mid-edit without breaking the row's alignment — in
 * `items-end` rows the field's bottom stays flush with its neighbours.
 */
export default function PriceInput({
  label,
  value,
  onChange,
  previousValue,
  currency = "MMK",
  className,
  wrapperClassName,
}: PriceInputProps) {
  const inputId = useId();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>("");
  // Hint appears once the edited value differs from the original price.
  const showOld = focused && previousValue != null && value !== previousValue;

  const handleChange = (raw: string) => {
    // Allow digits, commas, and one dot while typing.
    const cleaned = raw.replace(/[^0-9,.]/g, "").replace(/(\..*)\./g, "$1");
    setDraft(cleaned);
    onChange(parseAmountInput(cleaned));
  };

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {(label || showOld) && (
        <div className="flex h-5 items-center justify-between gap-2">
          {label && (
            <label htmlFor={inputId} className="truncate text-sm font-medium text-foreground-dim">
              {label}
            </label>
          )}
          {showOld && (
            <span className="shrink-0 text-xs text-muted">
              Old: {formatAmount(previousValue)} {currency}
            </span>
          )}
        </div>
      )}
      <Input
        id={inputId}
        type="text"
        inputMode="decimal"
        value={focused ? draft : formatAmount(value)}
        className={className}
        onFocus={() => {
          setDraft(String(value));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}

