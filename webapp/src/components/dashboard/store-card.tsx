"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatNumber } from "@/lib/utils";
import { Building2, Printer, TrendingUp, AlertTriangle } from "lucide-react";

interface StoreCardProps {
  name: string;
  region?: string | null;
  machineCount: number;
  activeMachines: number;
  monthlyAverage: number;
  colorPercentage: number;
  alerts?: number;
  onClick?: () => void;
  isSelected?: boolean;
}

export function StoreCard({
  name,
  region,
  machineCount,
  activeMachines,
  monthlyAverage,
  colorPercentage,
  alerts = 0,
  onClick,
  isSelected = false,
}: StoreCardProps) {
  const healthPercentage = machineCount > 0 ? (activeMachines / machineCount) * 100 : 0;

  return (
    <Card
      className={cn(
        "transition-all cursor-pointer hover:shadow-md",
        isSelected ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              {region && <p className="text-xs text-muted-foreground">{region}</p>}
            </div>
          </div>
          {alerts > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {alerts}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Machines</p>
            <div className="flex items-center gap-1">
              <Printer className="h-3 w-3 text-muted-foreground" />
              <span className="font-semibold">{machineCount}</span>
              <span className="text-xs text-muted-foreground">
                ({activeMachines} active)
              </span>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Monthly Avg</p>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="font-semibold">{formatNumber(monthlyAverage)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Fleet Health</span>
            <span className={cn(
              "font-medium",
              healthPercentage >= 90 ? "text-green-600" :
              healthPercentage >= 70 ? "text-yellow-600" : "text-red-600"
            )}>
              {healthPercentage.toFixed(0)}%
            </span>
          </div>
          <Progress value={healthPercentage} className="h-1.5" />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Color: {colorPercentage}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <span>B&W: {100 - colorPercentage}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
