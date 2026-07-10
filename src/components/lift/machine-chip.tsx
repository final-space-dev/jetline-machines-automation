"use client";

import { useDrag } from "react-dnd";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { Printer, GripVertical } from "lucide-react";
import type { MachineWithRelations } from "@/types";

interface MachineChipProps {
  machine: MachineWithRelations;
  isSelected: boolean;
  onSelect: () => void;
}

export function MachineChip({ machine, isSelected, onSelect }: MachineChipProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "MACHINE",
    item: { id: machine.id, storeId: machine.companyId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const categoryColors: Record<string, string> = {
    "Colour": "bg-blue-100 text-blue-800 border-blue-200",
    "Black and White": "bg-gray-100 text-gray-800 border-gray-200",
    "Plan": "bg-purple-100 text-purple-800 border-purple-200",
    "Office Machine": "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <div
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg border bg-card transition-all",
        isDragging && "opacity-50",
        isSelected ? "ring-2 ring-primary border-primary" : "hover:border-primary/50",
        "cursor-grab active:cursor-grabbing"
      )}
      onClick={onSelect}
    >
      <div className="p-1 text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="p-1.5 bg-primary/10 rounded">
        <Printer className="h-3 w-3 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium truncate">
            {machine.serialNumber}
          </span>
          {machine.category && (
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1", categoryColors[machine.category.name] || "")}
            >
              {machine.category.name}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {machine.modelName || "Unknown Model"}
        </p>
      </div>

      <div className="text-right">
        <p className="font-mono text-xs font-medium">{formatNumber(machine.currentBalance)}</p>
        <Badge
          variant={machine.status === "ACTIVE" ? "default" : "secondary"}
          className="text-[10px]"
        >
          {machine.status}
        </Badge>
      </div>
    </div>
  );
}
