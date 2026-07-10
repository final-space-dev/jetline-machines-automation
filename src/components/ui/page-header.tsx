"use client";

import { ReactNode } from "react";
import { Button } from "./button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  children?: ReactNode; // For action buttons
}

export function PageHeader({ title, description, backHref, children }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {backHref && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
