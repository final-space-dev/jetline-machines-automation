"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { EquipmentTypesPanel } from "./equipment-types/panel";
import { ConditionsPanel } from "./conditions/panel";
import { ModelsPanel } from "./models/panel";
import { StoreGroupsPanel } from "./store-groups/panel";
import { ConnectionsPanel } from "./connections/panel";
import { UsersPanel } from "./users/panel";

type TabKey =
  | "equipment-types"
  | "conditions"
  | "models"
  | "store-groups"
  | "connections"
  | "users";

const TABS: { key: TabKey; label: string }[] = [
  { key: "equipment-types", label: "Equipment Types" },
  { key: "conditions", label: "Conditions" },
  { key: "models", label: "Models" },
  { key: "store-groups", label: "Store Groups" },
  { key: "connections", label: "Connections" },
  { key: "users", label: "Users" },
];

const DEFAULT_TAB: TabKey = "equipment-types";

function isTabKey(value: string | undefined): value is TabKey {
  return TABS.some((t) => t.key === value);
}

export function SetupShell({ active }: { active?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(isTabKey(active) ? active : DEFAULT_TAB);

  function switchTab(key: TabKey) {
    if (key === tab) return;
    setTab(key);
    // Keep the URL linkable so deep links and refresh land on the right tab.
    router.replace(`/setup?tab=${key}`);
  }

  return (
    <AppShell>
      <div className="space-y-4" style={{ maxWidth: 1280, marginInline: "auto", width: "100%" }}>
        <h1 className="jl-h1">Setup</h1>
        <div className="jl-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => switchTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "equipment-types" && <EquipmentTypesPanel />}
        {tab === "conditions" && <ConditionsPanel />}
        {tab === "models" && <ModelsPanel />}
        {tab === "store-groups" && <StoreGroupsPanel />}
        {tab === "connections" && <ConnectionsPanel />}
        {tab === "users" && <UsersPanel />}
      </div>
    </AppShell>
  );
}
