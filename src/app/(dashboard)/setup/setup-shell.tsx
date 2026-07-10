"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { EquipmentTypesPanel } from "./equipment-types/panel";
import { ConditionsPanel } from "./conditions/panel";
import { ModelsPanel } from "./models/panel";
import { StoresPanel } from "./stores/panel";
import { UsersPanel } from "./users/panel";

type TabKey =
  | "stores"
  | "machine-mapping"
  | "equipment-types"
  | "conditions"
  | "models"
  | "users";

// Stores is first — a store is the cornerstone CRM entity. Machine Mapping is an
// admin data-capture exercise that lives here (out of the main menu); its tab links
// to the full-page tool rather than embedding it.
const TABS: { key: TabKey; label: string }[] = [
  { key: "stores", label: "Stores" },
  { key: "machine-mapping", label: "Machine Mapping" },
  { key: "models", label: "Models" },
  { key: "equipment-types", label: "Equipment Types" },
  { key: "conditions", label: "Conditions" },
  { key: "users", label: "Users" },
];

const DEFAULT_TAB: TabKey = "stores";

function isTabKey(value: string | undefined): value is TabKey {
  return TABS.some((t) => t.key === value);
}

export function SetupShell({ active }: { active?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(isTabKey(active) ? active : DEFAULT_TAB);

  function switchTab(key: TabKey) {
    // Machine Mapping is a full standalone page (heavy tool), so its tab navigates
    // there instead of rendering inline.
    if (key === "machine-mapping") {
      router.push("/machine-mapping");
      return;
    }
    if (key === tab) return;
    setTab(key);
    // Keep the URL linkable so deep links and refresh land on the right tab.
    router.replace(`/setup?tab=${key}`);
  }

  return (
    <AppShell>
      <div className="space-y-4" style={{ maxWidth: 1280, marginInline: "auto", width: "100%" }}>
        <h1 className="jl-h1">Config</h1>
        <div className="jl-tabs" role="tablist">
          {TABS.map((t) =>
            t.key === "machine-mapping" ? (
              <Link key={t.key} href="/machine-mapping" role="tab" aria-selected={false}>
                {t.label}
              </Link>
            ) : (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => switchTab(t.key)}
              >
                {t.label}
              </button>
            )
          )}
        </div>

        {tab === "stores" && <StoresPanel />}
        {tab === "models" && <ModelsPanel />}
        {tab === "equipment-types" && <EquipmentTypesPanel />}
        {tab === "conditions" && <ConditionsPanel />}
        {tab === "users" && <UsersPanel />}
      </div>
    </AppShell>
  );
}
