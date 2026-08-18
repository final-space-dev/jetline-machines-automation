"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/lib/use-role";
import { canConfig } from "@/lib/permissions";
import { EquipmentTypesPanel } from "./equipment-types/panel";
import { ConditionsPanel } from "./conditions/panel";
import { ModelsPanel } from "./models/panel";
import { StoresPanel } from "./stores/panel";
import { UsersPanel } from "./users/panel";
import { ImportPanel } from "./import/panel";
import { SuppliersPanel } from "./suppliers/panel";
import { RecentlyDeletedPanel } from "./recently-deleted/panel";
import { MachineMappingPanel } from "../machine-mapping/panel";

type TabKey =
  | "stores"
  | "machine-mapping"
  | "import"
  | "models"
  | "suppliers"
  | "equipment-types"
  | "conditions"
  | "users"
  | "recently-deleted";

// Stores is first — a store is the cornerstone CRM entity. Machine Mapping is an
// admin data-capture exercise that lives here (out of the main menu); its tab links
// to the full-page tool rather than embedding it.
const TABS: { key: TabKey; label: string }[] = [
  { key: "stores", label: "Stores" },
  { key: "machine-mapping", label: "Machine Mapping" },
  { key: "import", label: "Import" },
  { key: "models", label: "Models" },
  { key: "suppliers", label: "Suppliers" },
  { key: "equipment-types", label: "Equipment Types" },
  { key: "conditions", label: "Conditions" },
  { key: "users", label: "Users" },
  { key: "recently-deleted", label: "Recently Deleted" },
];

const DEFAULT_TAB: TabKey = "stores";

function isTabKey(value: string | undefined): value is TabKey {
  return TABS.some((t) => t.key === value);
}

export function SetupShell({ active }: { active?: string }) {
  const router = useRouter();
  const { role, permissions } = useRole();

  // Admins see every tab. Custom users see only the config sections they hold
  // (server routes hard-block the rest). "users" is never grantable, so it is
  // naturally hidden for custom users.
  const visibleTabs = useMemo(
    () =>
      role === "custom"
        ? TABS.filter((t) => canConfig(role, permissions, t.key))
        : TABS,
    [role, permissions],
  );

  // Land on the requested tab if allowed, else the first tab the user can see.
  const initialTab: TabKey =
    isTabKey(active) && visibleTabs.some((t) => t.key === active)
      ? active
      : visibleTabs[0]?.key ?? DEFAULT_TAB;
  const [tab, setTab] = useState<TabKey>(initialTab);

  // If the active tab is not (or no longer) permitted, snap to the first allowed.
  const activeTab: TabKey = visibleTabs.some((t) => t.key === tab)
    ? tab
    : visibleTabs[0]?.key ?? tab;

  function switchTab(key: TabKey) {
    if (key === activeTab) return;
    setTab(key);
    // Keep the URL linkable so deep links and refresh land on the right tab.
    router.replace(`/setup?tab=${key}`);
  }

  // Machine Mapping is a wide tool; give its tab panel room while keeping the
  // narrower max-width for the form-style panels.
  const wide = activeTab === "machine-mapping";

  return (
    <AppShell>
      <div className="space-y-4" style={{ maxWidth: wide ? 1720 : 1280, marginInline: "auto", width: "100%" }}>
        <h1 className="jl-h1">Config</h1>
        <div className="jl-tabs" role="tablist">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => switchTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "stores" && <StoresPanel />}
        {activeTab === "machine-mapping" && <MachineMappingPanel embedded />}
        {activeTab === "import" && <ImportPanel />}
        {activeTab === "models" && <ModelsPanel />}
        {activeTab === "suppliers" && <SuppliersPanel />}
        {activeTab === "equipment-types" && <EquipmentTypesPanel />}
        {activeTab === "conditions" && <ConditionsPanel />}
        {activeTab === "users" && <UsersPanel />}
        {activeTab === "recently-deleted" && <RecentlyDeletedPanel />}
      </div>
    </AppShell>
  );
}
