"use client";

import { useState, type ComponentProps } from "react";
import Input from "./Input";
import { clampNumber, parseNumericInput, sanitizeNumericInput } from "@/lib/number";

type InputProps = ComponentProps<typeof Input>;

interface NumericInputProps extends Omit<InputProps, "type" | "value" | "onChange" | "inputMode"> {
  value: number;
  onChange: (value: number) => void;
  /** Allow one decimal point while typing (default: whole numbers only). */
  allowDecimal?: boolean;
}

/**
 * Number input that behaves like a text field while editing:
 * the raw draft (including leading zeros, e.g. "007") is preserved until blur,
 * then normalized. Uses `type="text"` + `inputMode` so the browser's native
 * number parsing/validation can't strip leading zeros or reject partial input.
 */
export default function NumericInput({
  value,
  onChange,
  allowDecimal = false,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <Input
      {...props}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={focused ? draft : String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        // Normalize on blur: drop leading zeros and respect min/max bounds.
        const parsed = parseNumericInput(draft);
        const clamped = clampNumber(parsed, props.min, props.max);
        if (clamped !== parsed) onChange(clamped);
        onBlur?.(e);
      }}
      onChange={(e) => {
        const cleaned = sanitizeNumericInput(e.target.value, allowDecimal);
        setDraft(cleaned);
        onChange(parseNumericInput(cleaned));
      }}
    />
  );
}
