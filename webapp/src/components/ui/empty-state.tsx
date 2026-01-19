"use client";

import { LucideIcon, Search, FileX, Inbox } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "compact" | "inline";
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  if (variant === "inline") {
    return (
      <div className={cn("py-8 text-center text-sm text-muted-foreground", className)}>
        {title}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 px-4", className)}>
        <Icon className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground text-center">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground/70 text-center mt-1">{description}</p>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-configured variants for common use cases
export function NoResults({ searchTerm, onClear }: { searchTerm?: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={searchTerm ? `No matches for "${searchTerm}"` : "Try adjusting your filters"}
      action={onClear ? { label: "Clear filters", onClick: onClear } : undefined}
    />
  );
}

export function NotFoundState({ type = "item" }: { type?: string }) {
  return (
    <EmptyState
      icon={FileX}
      title={`${type.charAt(0).toUpperCase() + type.slice(1)} not found`}
      description={`The ${type} you're looking for doesn't exist or has been removed`}
      variant="default"
    />
  );
}

export function NoData({ message = "No data available" }: { message?: string }) {
  return (
    <EmptyState
      icon={Inbox}
      title={message}
      variant="compact"
    />
  );
}
