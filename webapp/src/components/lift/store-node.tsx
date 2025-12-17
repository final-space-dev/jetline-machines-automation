"use client";

import { useDrop } from "react-dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { Building2, Printer, MapPin } from "lucide-react";
import type { MachineWithRelations } from "@/types";

interface StoreNodeProps {
  store: {
    id: string;
    name: string;
    region: string | null;
    x: number;
    y: number;
  };
  machines: MachineWithRelations[];
  isSelected: boolean;
  onSelect: () => void;
  onDrop: (machineId: string, fromStoreId: string, toStoreId: string) => void;
}

export function StoreNode({ store, machines, isSelected, onSelect, onDrop }: StoreNodeProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: "MACHINE",
    drop: (item: { id: string; storeId: string }) => {
      if (item.storeId !== store.id) {
        onDrop(item.id, item.storeId, store.id);
      }
    },
    canDrop: (item: { id: string; storeId: string }) => item.storeId !== store.id,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const totalBalance = machines.reduce((sum, m) => sum + m.currentBalance, 0);

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      style={{
        position: "absolute",
        left: `${store.x}%`,
        top: `${store.y}%`,
        transform: "translate(-50%, -50%)",
      }}
      onClick={onSelect}
    >
      <Card
        className={cn(
          "w-40 cursor-pointer transition-all duration-200",
          isSelected && "ring-2 ring-primary border-primary shadow-lg",
          isOver && canDrop && "ring-2 ring-green-500 border-green-500 bg-green-50",
          !isSelected && !isOver && "hover:shadow-md hover:border-primary/50"
        )}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "p-1.5 rounded-md",
              isOver && canDrop ? "bg-green-100" : "bg-primary/10"
            )}>
              <Building2 className={cn(
                "h-4 w-4",
                isOver && canDrop ? "text-green-600" : "text-primary"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{store.name}</h3>
              {store.region && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {store.region}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Printer className="h-3 w-3" />
                Machines
              </span>
              <Badge variant="secondary" className="text-xs">
                {machines.length}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-mono font-medium">{formatNumber(totalBalance)}</span>
            </div>
          </div>

          {isOver && canDrop && (
            <div className="mt-2 p-1 bg-green-100 rounded text-center text-xs text-green-700 font-medium">
              Drop to move here
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
