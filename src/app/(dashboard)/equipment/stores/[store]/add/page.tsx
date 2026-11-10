"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { ModelSuggest } from "@/components/equipment/model-suggest";
import { Field } from "@/components/machines/field";
import { LinkButton } from "@/components/machines/link-button";
import { Page } from "@/components/machines/page";
import { Panel } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { EQUIPMENT_STATUS_LABEL } from "@/components/machines/status-badge";
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES, type EquipmentStatus } from "@/lib/equipment-utils";
import { toast } from "@/lib/toast";

const CONDITION_OPTIONS = [
  { value: "Good", label: "Good" },
  { value: "Fair", label: "Fair" },
  { value: "Poor", label: "Poor" },
];

// ─── Add Equipment full-page form ──────────────────────────────────────────────

export default function AddEquipmentPage() {
  const params = useParams();
  const router = useRouter();
  const storeName = decodeURIComponent(params.store as string);

  const [type, setType] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [serial, setSerial] = useState("");
  const [status, setStatus] = useState<EquipmentStatus>("active");
  const [condition, setCondition] = useState("Good");
  const [saving, setSaving] = useState(false);

  const storeHref = `/equipment/stores/${encodeURIComponent(storeName)}`;

  const save = async () => {
    if (!type) { toast.error("Equipment type is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: storeName,
          machine_type: type,
          make_model: makeModel,
          serial,
          condition,
          status,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Equipment added");
      router.push(storeHref);
    } catch {
      toast.error("Failed to add equipment");
      setSaving(false);
    }
  };

  return (
    <Page
      title="Add Equipment"
      crumbs={[{ label: "Stores", href: "/equipment" }, { label: storeName, href: storeHref }, { label: "Add Equipment" }]}
    >
      <Panel className="w-full max-w-3xl">
        <div className="flex flex-col gap-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type *" htmlFor="eq-type">
              <Pick id="eq-type" value={type} onChange={setType} placeholder="Select type" options={EQUIPMENT_TYPES.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Make / Model">
              <ModelSuggest value={makeModel} onChange={setMakeModel} placeholder="Search or add model" />
            </Field>
            <Field label="Serial" htmlFor="eq-serial">
              <Input id="eq-serial" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status" className="sm:col-span-2">
              <Segmented value={status} onValueChange={(v) => setStatus(v as EquipmentStatus)} options={EQUIPMENT_STATUSES.map((s) => ({ value: s, label: EQUIPMENT_STATUS_LABEL[s] }))} />
            </Field>
            <Field label="Condition" htmlFor="eq-condition">
              <Pick id="eq-condition" value={condition} onChange={setCondition} options={CONDITION_OPTIONS} />
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2.5">
            <LinkButton href={storeHref} variant="outline">Cancel</LinkButton>
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner /> : <Plus />} Save Equipment
            </Button>
          </div>
        </div>
      </Panel>
    </Page>
  );
}
