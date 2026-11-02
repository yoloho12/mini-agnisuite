"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Icon rendered inside the field, on the left (e.g. a search glyph). */
  iconLeft?: ReactNode;
  /** Classes for the outer wrapper (width/layout control in flex rows). */
  wrapperClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, iconLeft, wrapperClassName, ...props }, ref) => {
    // Only derive an id from a non-empty label — `label=""` (row placeholders)
    // must not emit duplicate empty ids.
    const inputId =
      id ?? (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : undefined);
    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground-dim">
            {label}
          </label>
        )}
        <div className="relative">
          {iconLeft && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-10 w-full rounded-lg border border-border bg-card text-sm text-foreground",
              "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
              "transition-colors",
              iconLeft ? "pl-9 pr-3" : "px-3",
              error && "border-danger focus:ring-danger/50",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
