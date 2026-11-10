"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { Muted } from "@/components/machines/panel";
import { SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

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

  return (
    <Page title="Stores">
      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <Link
              key={s.store}
              href={`/equipment/stores/${encodeURIComponent(s.store)}`}
              className={cn(SURFACE.cardRaised, "flex items-center gap-3 p-4 outline-none hover:bg-muted focus-visible:bg-muted")}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Store className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn(TYPE.data, "truncate font-medium")}>{s.store}</span>
                <Muted>{s.count} items</Muted>
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
