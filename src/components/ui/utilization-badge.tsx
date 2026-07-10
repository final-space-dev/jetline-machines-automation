"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";

export type UtilizationStatus = "critical" | "low" | "optimal" | "high" | "overworked";

export const utilizationConfig: Record<UtilizationStatus, {
  color: string;
  bgColor: string;
  badgeBg: string;
  label: string;
  description: string;
}> = {
  critical: {
    color: "text-red-600",
    bgColor: "bg-red-500",
    badgeBg: "bg-red-100 text-red-700 border-red-300",
    label: "Critical",
    description: "Under 20% utilization - strong lift candidate"
  },
  low: {
    color: "text-amber-600",
    bgColor: "bg-amber-500",
    badgeBg: "bg-amber-100 text-amber-700 border-amber-300",
    label: "Low",
    description: "20-40% utilization - consider relocating"
  },
  optimal: {
    color: "text-emerald-600",
    bgColor: "bg-emerald-500",
    badgeBg: "bg-emerald-100 text-emerald-700 border-emerald-300",
    label: "Optimal",
    description: "40-80% utilization - healthy performance"
  },
  high: {
    color: "text-blue-600",
    bgColor: "bg-blue-500",
    badgeBg: "bg-blue-100 text-blue-700 border-blue-300",
    label: "High",
    description: "80-100% utilization - high demand"
  },
  overworked: {
    color: "text-purple-600",
    bgColor: "bg-purple-500",
    badgeBg: "bg-purple-100 text-purple-700 border-purple-300",
    label: "Overworked",
    description: "Over 100% utilization - needs support"
  },
};

interface UtilizationBadgeProps {
  percent: number;
  status: UtilizationStatus;
  showTooltip?: boolean;
  size?: "sm" | "md";
}

export function UtilizationBadge({
  percent,
  status,
  showTooltip = true,
  size = "sm"
}: UtilizationBadgeProps) {
  const config = utilizationConfig[status];

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        config.badgeBg,
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
      )}
    >
      {percent}%
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface UtilizationBarProps {
  percent: number;
  status: UtilizationStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function UtilizationBar({
  percent,
  status,
  showLabel = true,
  size = "sm"
}: UtilizationBarProps) {
  const config = utilizationConfig[status];

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-[10px]">
          <span className={cn("font-medium", config.color)}>
            {percent}%
          </span>
        </div>
      )}
      <div className={cn(
        "bg-muted rounded-full overflow-hidden",
        size === "sm" ? "h-1.5" : "h-2"
      )}>
        <div
          className={cn("h-full rounded-full transition-all", config.bgColor)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface TrendIndicatorProps {
  direction: "up" | "down" | "stable";
  value?: number;
  showValue?: boolean;
}

export function TrendIndicator({
  direction,
  value,
  showValue = false
}: TrendIndicatorProps) {
  return (
    <span className="flex items-center gap-0.5 text-[10px]">
      {direction === "up" && (
        <TrendingUp className="h-3 w-3 text-emerald-500" />
      )}
      {direction === "down" && (
        <TrendingDown className="h-3 w-3 text-red-500" />
      )}
      {direction === "stable" && (
        <Minus className="h-3 w-3 text-muted-foreground" />
      )}
      {showValue && value !== undefined && (
        <span className={cn(
          direction === "up" && "text-emerald-600",
          direction === "down" && "text-red-600",
          direction === "stable" && "text-muted-foreground"
        )}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      )}
    </span>
  );
}

interface LiftScoreBadgeProps {
  score: number;
  showTooltip?: boolean;
}

export function LiftScoreBadge({ score, showTooltip = true }: LiftScoreBadgeProps) {
  if (score < 60) return null;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "text-[9px] px-1 py-0",
        score >= 80
          ? "bg-red-100 text-red-700 border-red-300"
          : "bg-amber-100 text-amber-700 border-amber-300"
      )}
    >
      <Target className="h-2.5 w-2.5 mr-0.5" />
      {score}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Lift Score: {score}/100</p>
          <p className="text-xs text-muted-foreground">
            {score >= 80 ? "Strong lift candidate" : "Consider for relocation"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
