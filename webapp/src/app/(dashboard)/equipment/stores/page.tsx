"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Store, ChevronRight } from "lucide-react";
import Link from "next/link";

interface StoreStats {
  store: string;
  count: string;
}

export default function EquipmentStoresPage() {
  const [stores, setStores] = useState<StoreStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/equipment")
      .then((r) => r.json())
      .then((d) => setStores(d.stores))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl space-y-5">
        <div>
          <h1 className="text-lg font-semibold">Stores</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Click a store to view its machines and equipment</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {stores.map((s) => (
            <Link key={s.store} href={`/equipment/stores/${encodeURIComponent(s.store)}`}>
              <div className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.store}</p>
                  <p className="text-xs text-muted-foreground">{s.count} items</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
