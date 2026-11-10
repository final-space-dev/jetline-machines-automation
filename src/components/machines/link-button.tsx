"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

/** A kit Button that is a link: to a page, a new tab, a download, or a full page load. */
export function LinkButton({
  href,
  external = false,
  download = false,
  hard = false,
  variant,
  size,
  className,
  "aria-label": ariaLabel,
  children,
}: {
  href: string;
  external?: boolean;
  download?: boolean;
  hard?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const render = download ? <a href={href} download /> : external ? <a href={href} target="_blank" rel="noreferrer" /> : hard ? <a href={href} /> : <Link href={href} />;
  return (
    <Button variant={variant} size={size} className={className} aria-label={ariaLabel} render={render}>
      {children}
    </Button>
  );
}
