import { formatDate } from "@/lib/utils";

export interface ActivityEntry {
  id: number;
  item_type: "equipment" | "printer";
  ref: string;
  store: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  user_name: string;
  changed_at: string;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return formatDate(iso);
}
