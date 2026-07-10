import type { ReactNode } from "react";

export interface JlSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

/** label.jl-switch per the showcase (input + track + thumb + label). */
export function JlSwitch({ checked, onChange, label, disabled }: JlSwitchProps) {
  return (
    <label className="jl-switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track" />
      <span className="thumb" />
      {label !== undefined ? <span className="label">{label}</span> : null}
    </label>
  );
}

export default JlSwitch;
