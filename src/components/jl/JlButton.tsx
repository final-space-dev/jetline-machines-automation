import type { ButtonHTMLAttributes, ReactNode } from "react";

export type JlButtonVariant =
  | "primary"
  | "secondary"
  | "soft"
  | "ghost"
  | "dark";

export interface JlButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: JlButtonVariant;
  size?: "sm" | "lg";
  icon?: ReactNode;
  iconOnly?: boolean;
  block?: boolean;
  loading?: boolean;
}

/** button.jl-btn with variant / size / icon modifiers. */
export function JlButton({
  variant = "secondary",
  size,
  icon,
  iconOnly,
  block,
  loading,
  className,
  children,
  disabled,
  type,
  ...rest
}: JlButtonProps) {
  const cls = [
    "jl-btn",
    `jl-btn--${variant}`,
    size ? `jl-btn--${size}` : "",
    iconOnly ? "jl-btn--icon" : "",
    block ? "jl-btn--block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type ?? "button"}
      className={cls}
      disabled={disabled || loading}
      {...(loading ? { "data-loading": "" } : null)}
      {...rest}
    >
      {children}
      {icon}
    </button>
  );
}

export default JlButton;
