"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * Choosing files: a kit Button that opens the browser's own file chooser.
 * This is the one place a native file input lives (the audit exempts this
 * file and no other); the input itself is never shown.
 */
export function FilePicker({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  variant = "outline",
  size = "sm",
  className,
  "aria-label": ariaLabel,
  children,
}: {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          // Copy first: clearing the value (so the same file can be chosen again) empties the live list.
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <Button type="button" variant={variant} size={size} className={className} aria-label={ariaLabel} disabled={disabled} onClick={() => ref.current?.click()}>
        {children}
      </Button>
    </>
  );
}
