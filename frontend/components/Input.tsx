"use client";

import { useId } from "react";

interface InputProps {
  type?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Override the auto-generated id. Useful when the caller already has
   * a stable id for the input or wants to wire up a custom describedby. */
  id?: string;
  /** Optional helper text, rendered below the input and linked via
   * aria-describedby so screen readers announce it after the label. */
  describedById?: string;
  /** Native autocomplete hint — e.g. "email", "current-password",
   * "new-password", "name". */
  autoComplete?: string;
}

/**
 * Form input with proper a11y wiring:
 * - <label htmlFor> linked to a unique <input id>
 * - aria-invalid + aria-errormessage when an error is shown
 * - error message in role="alert" so it is announced live
 * - required maps to aria-required
 */
export function Input({
  type = "text",
  label,
  placeholder,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  autoFocus = false,
  id,
  describedById,
  autoComplete,
}: InputProps) {
  const reactId = useId();
  const inputId = id ?? `input-${reactId}`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [error ? errorId : null, describedById].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium input-label">
          {label}
          {required && (
            <span className="text-error ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className={`input-base ${error ? "input-error" : ""}`}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
