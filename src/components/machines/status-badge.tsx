import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { classifyCondition, type ConditionBucket, type EquipmentStatus } from "@/lib/equipment-utils";

type Status = "success" | "warning" | "danger" | "info" | "elim" | "neutral";

const CONDITION: Record<ConditionBucket, [string, Status]> = {
  good: ["Good", "success"],
  fair: ["Fair", "warning"],
  poor: ["Poor", "danger"],
  unknown: ["Unknown", "neutral"],
};

const EQUIPMENT: Record<EquipmentStatus, [string, Status]> = {
  active: ["Active", "success"],
  inactive: ["Inactive", "neutral"],
  disposed: ["Disposed", "danger"],
  transferred: ["Transferred", "info"],
};

export const EQUIPMENT_STATUS_LABEL: Record<EquipmentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  disposed: "Disposed",
  transferred: "Transferred",
};

/** A condition as its bucket: Good, Fair, Poor or Unknown. Pass `bucket` when it is already classified. */
export function ConditionBadge({ condition, bucket }: { condition?: string | null; bucket?: ConditionBucket }) {
  const [label, status] = CONDITION[bucket ?? classifyCondition(condition)];
  return <Badge status={status}>{label}</Badge>;
}

/** An equipment item's status. */
export function EquipmentStatusBadge({ status }: { status: EquipmentStatus | string | null | undefined }) {
  const [label, tone] = EQUIPMENT[(status ?? "active") as EquipmentStatus] ?? [String(status), "neutral"];
  return <Badge status={tone}>{label}</Badge>;
}

export type UtilizationStatus = "critical" | "low" | "optimal" | "high" | "overworked";

/** The five utilisation bands, as the server classifies them. */
export const UTILIZATION: Record<UtilizationStatus, { label: string; status: Status; means: string }> = {
  critical: { label: "Critical", status: "danger", means: "Under 20% utilisation: strong lift candidate" },
  low: { label: "Low", status: "warning", means: "20 to 40% utilisation: consider relocating" },
  optimal: { label: "Optimal", status: "success", means: "40 to 80% utilisation: healthy performance" },
  high: { label: "High", status: "info", means: "80 to 100% utilisation: high demand" },
  overworked: { label: "Overworked", status: "elim", means: "Over 100% utilisation: needs support" },
};

/** A utilisation figure in its band's colour; the band's meaning is on hover. */
export function UtilizationBadge({ percent, status }: { percent: number; status: UtilizationStatus }) {
  const band = UTILIZATION[status] ?? UTILIZATION.optimal;
  return (
    <Tooltip content={`${band.label}. ${band.means}`}>
      <Badge status={band.status}>{percent}%</Badge>
    </Tooltip>
  );
}

/** How complete a store's records are, 0 to 100: over 80 is good, 50 to 80 needs work, under 50 is poor. */
export function CompletenessBadge({ score, title }: { score: number | null | undefined; title?: string }) {
  const known = typeof score === "number" && Number.isFinite(score);
  if (!known) return <Badge status="neutral" title={title ?? "Completeness not scored yet"}>Not scored</Badge>;
  const rounded = Math.round(score);
  const status: Status = rounded > 80 ? "success" : rounded >= 50 ? "warning" : "danger";
  return <Badge status={status} title={title ?? `${rounded}% complete`}>{rounded}%</Badge>;
}
