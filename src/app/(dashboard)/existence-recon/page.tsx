"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/data-table/data-table";
import { PageLoading } from "@/components/ui/page-loading";

interface ExistenceRow {
  serial: string;
  source: "BMS Only" | "Xerox Only" | "Both";
  store: string;
  group: string;
  category: string;
  model: string;
  installDate: string;
  customer: string;
  product: string;
  totalBilled: number | null;
  latestMonth: string;
}

function fmtRand(n: number | null | undefined) {
  if (n == null || n === 0) return "\u2014";
  return `R${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m) - 1]} ${y}`;
}

const SOURCE_COLORS: Record<string, string> = {
  "Xerox Only": "bg-red-100 text-red-800",
  "BMS Only": "bg-amber-100 text-amber-800",
  "Both": "bg-green-100 text-green-800",
};

const columns: ColumnDef<ExistenceRow>[] = [
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => {
      const source = row.getValue("source") as string;
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLORS[source] ?? ""}`}>
          {source}
        </span>
      );
    },
  },
  { accessorKey: "serial", header: "Serial", cell: ({ row }) => <span className="font-mono">{row.getValue("serial")}</span> },
  { accessorKey: "group", header: "Group", cell: ({ row }) => row.getValue("group") || "\u2014" },
  { accessorKey: "store", header: "Store (BMS)", cell: ({ row }) => row.getValue("store") || "\u2014" },
  { accessorKey: "customer", header: "Customer (Xerox)", cell: ({ row }) => <span className="text-xs">{row.getValue("customer") || "\u2014"}</span> },
  { accessorKey: "category", header: "Category", cell: ({ row }) => row.getValue("category") || "\u2014" },
  { accessorKey: "model", header: "Model", cell: ({ row }) => <span className="text-xs">{row.getValue("model") || "\u2014"}</span> },
  { accessorKey: "product", header: "Product (Xerox)", cell: ({ row }) => <span className="text-xs">{row.getValue("product") || "\u2014"}</span> },
  { accessorKey: "installDate", header: "Install Date", cell: ({ row }) => row.getValue("installDate") || "\u2014" },
  {
    accessorKey: "totalBilled",
    header: "Total Billed",
    cell: ({ row }) => (
      <span className="font-mono text-right block text-green-700 font-medium">
        {fmtRand(row.original.totalBilled)}
      </span>
    ),
  },
  { accessorKey: "latestMonth", header: "Latest Month", cell: ({ row }) => {
    const v = row.getValue("latestMonth") as string;
    return v ? formatMonthLabel(v) : "\u2014";
  }},
];

export default function ExistenceReconPage() {
  const [data, setData] = useState<ExistenceRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [counts, setCounts] = useState({ bmsOnly: 0, xeroxOnly: 0, both: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/existence-recon");
      const json = await res.json();
      setData(json.data ?? []);
      setMonths(json.months ?? []);
      setCounts(json.counts ?? { bmsOnly: 0, xeroxOnly: 0, both: 0 });
    } catch (err) {
      console.error("Existence Recon fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filterOptions = useMemo(() => {
    const sources = new Set<string>();
    const groups = new Set<string>();
    const stores = new Set<string>();
    const categories = new Set<string>();
    const products = new Set<string>();
    data.forEach((r) => {
      sources.add(r.source);
      if (r.group) groups.add(r.group);
      if (r.store) stores.add(r.store);
      if (r.category) categories.add(r.category);
      if (r.product) products.add(r.product);
    });
    return {
      sources: Array.from(sources).sort().map((v) => ({ value: v, label: v })),
      groups: Array.from(groups).sort().map((v) => ({ value: v, label: v })),
      stores: Array.from(stores).sort().map((v) => ({ value: v, label: v })),
      categories: Array.from(categories).sort().map((v) => ({ value: v, label: v })),
      products: Array.from(products).sort().map((v) => ({ value: v, label: v })),
    };
  }, [data]);

  const monthLabel = months.length > 0
    ? months.map(formatMonthLabel).join(", ")
    : "";

  return (
    <AppShell>
      <div className="space-y-2">
        <div>
          <h1 className="text-lg font-semibold">Existence Recon</h1>
          <p className="text-xs text-muted-foreground">
            {months.length > 0 && <>Covering: {monthLabel} &middot; </>}
            <span className={SOURCE_COLORS["Xerox Only"]}>{counts.xeroxOnly} Xerox Only</span>
            {" \u00B7 "}
            <span className={SOURCE_COLORS["BMS Only"]}>{counts.bmsOnly} BMS Only</span>
            {" \u00B7 "}
            <span className={SOURCE_COLORS["Both"]}>{counts.both} Both</span>
          </p>
        </div>

        {loading ? (
          <PageLoading variant="table" />
        ) : data.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No data available.</p>
            <p className="text-xs mt-1">Import Xerox data and sync BMS first.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            tableId="existence-recon"
            searchPlaceholder="Search serial, store, customer..."
            filterColumns={[
              { key: "source", label: "Source", options: filterOptions.sources },
              { key: "group", label: "Group", options: filterOptions.groups },
              { key: "store", label: "Store", options: filterOptions.stores },
              { key: "category", label: "Category", options: filterOptions.categories },
              { key: "product", label: "Product", options: filterOptions.products },
            ]}
            exportFileName="existence-recon"
            pageSize={99999}
          />
        )}
      </div>
    </AppShell>
  );
}
