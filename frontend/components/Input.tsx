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
}

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
}: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium input-label">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`input-base ${error ? "input-error" : ""}`}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
