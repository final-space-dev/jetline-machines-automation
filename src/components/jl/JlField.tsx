import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export interface JlFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children?: ReactNode;
}

/** div.jl-field > label + control + optional hint / error. */
export function JlField({ label, hint, error, children }: JlFieldProps) {
  return (
    <div className="jl-field">
      <label>{label}</label>
      {children}
      {error ? (
        <span className="hint hint--error">{error}</span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

export interface JlInputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/** input.jl-input filled well. */
export function JlInput({ error, className, ...rest }: JlInputProps) {
  const cls = ["jl-input", error ? "is-error" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <input className={cls} {...rest} />;
}

export interface JlTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

/** textarea.jl-textarea filled well. */
export function JlTextarea({ className, ...rest }: JlTextareaProps) {
  const cls = ["jl-textarea", className ?? ""].filter(Boolean).join(" ");
  return <textarea className={cls} {...rest} />;
}

export interface JlSelectOption {
  value: string;
  label: string;
}

export interface JlSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  options: JlSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * div.jl-select-wrap > styled native select.jl-select.
 * The kit draws the chevron via .jl-select-wrap::after, so do not add one.
 */
export function JlSelect({
  options,
  value,
  onChange,
  className,
  ...rest
}: JlSelectProps) {
  const cls = ["jl-select", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className="jl-select-wrap">
      <select
        className={cls}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default JlField;
