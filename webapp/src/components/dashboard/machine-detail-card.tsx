"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn, formatNumber, formatDate, formatCurrency } from "@/lib/utils";
import {
  Printer,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  MoreVertical,
  Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MachineWithRelations } from "@/types";

interface MachineDetailCardProps {
  machine: MachineWithRelations;
  onLift?: () => void;
  onViewDetails?: () => void;
  isSelected?: boolean;
  onClick?: () => void;
}

export function MachineDetailCard({
  machine,
  onLift,
  onViewDetails,
  isSelected = false,
  onClick,
}: MachineDetailCardProps) {
  const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    ACTIVE: "default",
    INACTIVE: "secondary",
    MAINTENANCE: "outline",
    DECOMMISSIONED: "destructive",
  };

  const categoryColors: Record<string, string> = {
    "Colour": "bg-blue-100 text-blue-800 border-blue-200",
    "Black and White": "bg-gray-100 text-gray-800 border-gray-200",
    "Plan": "bg-purple-100 text-purple-800 border-purple-200",
    "Office Machine": "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <Card
      className={cn(
        "transition-all",
        onClick && "cursor-pointer hover:shadow-md",
        isSelected ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Printer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-mono">{machine.serialNumber}</CardTitle>
              <p className="text-xs text-muted-foreground">{machine.bmsMachineNo || "No BMS ID"}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewDetails}>
                <Activity className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLift}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Lift Machine
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusVariants[machine.status]}>{machine.status}</Badge>
          {machine.category && (
            <Badge variant="outline" className={categoryColors[machine.category.name] || ""}>
              {machine.category.name}
            </Badge>
          )}
          {machine.isLifted && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Lifted
            </Badge>
          )}
        </div>

        {/* Model Info */}
        <div className="space-y-1">
          <p className="text-sm font-medium">{machine.modelName || "Unknown Model"}</p>
          {machine.makeName && (
            <p className="text-xs text-muted-foreground">Make: {machine.makeName}</p>
          )}
        </div>

        <Separator />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Current Balance</p>
            <p className="font-mono font-semibold">{formatNumber(machine.currentBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Reading</p>
            <p className="text-sm">{formatDate(machine.lastReadingDate)}</p>
          </div>
        </div>

        {/* Contract Info */}
        {machine.contractType && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                Contract Details
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{machine.contractType}</p>
                </div>
                {machine.rentalEndDate && (
                  <div>
                    <p className="text-muted-foreground">Ends</p>
                    <p className="font-medium">{formatDate(machine.rentalEndDate)}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Dates */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {machine.installDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Installed: {formatDate(machine.installDate)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
