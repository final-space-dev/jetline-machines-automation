import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number with thousands separator
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-ZA").format(value);
}

/**
 * Format a number as currency (ZAR)
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a date to readable string
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date with time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

// ============================================
// STATUS & BADGE UTILITIES
// ============================================

export type MachineStatusType = "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "DECOMMISSIONED";
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * Get badge variant for machine status
 */
export function getStatusVariant(status: MachineStatusType): BadgeVariant {
  const variants: Record<MachineStatusType, BadgeVariant> = {
    ACTIVE: "default",
    INACTIVE: "secondary",
    MAINTENANCE: "outline",
    DECOMMISSIONED: "destructive",
  };
  return variants[status] || "outline";
}

/**
 * Get text color class for status (for non-badge usage)
 */
export function getStatusColor(status: MachineStatusType): string {
  const colors: Record<MachineStatusType, string> = {
    ACTIVE: "text-green-600",
    INACTIVE: "text-yellow-600",
    MAINTENANCE: "text-blue-600",
    DECOMMISSIONED: "text-red-600",
  };
  return colors[status] || "text-muted-foreground";
}

/**
 * Get background color class for category badges
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Colour": "bg-blue-100 text-blue-800 border-blue-200",
    "Black and White": "bg-gray-100 text-gray-800 border-gray-200",
    "Plan": "bg-purple-100 text-purple-800 border-purple-200",
    "Office Machine": "bg-green-100 text-green-800 border-green-200",
  };
  return colors[category] || "bg-gray-100 text-gray-800 border-gray-200";
}

/**
 * Get color for contract status based on months remaining
 */
export function getContractStatusColor(monthsRemaining: number | null): string {
  if (monthsRemaining === null) return "text-muted-foreground";
  if (monthsRemaining <= 0) return "text-red-600";
  if (monthsRemaining <= 3) return "text-red-600";
  if (monthsRemaining <= 12) return "text-yellow-600";
  return "text-green-600";
}

/**
 * Get badge variant for contract months remaining
 */
export function getContractBadgeVariant(monthsRemaining: number | null): BadgeVariant {
  if (monthsRemaining === null) return "outline";
  if (monthsRemaining <= 3) return "destructive";
  if (monthsRemaining <= 12) return "outline";
  return "secondary";
}
