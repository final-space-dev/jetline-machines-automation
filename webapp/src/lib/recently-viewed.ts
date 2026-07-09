"use client";

const KEY = "jl_equipment_recent";
const MAX = 8;

export interface RecentItem {
  type: "item" | "printer" | "store";
  id: string;
  label: string;
  sub: string;
  href: string;
  ts: number;
}

export function addRecentItem(entry: Omit<RecentItem, "ts">) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    const existing: RecentItem[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((e) => e.href !== entry.href);
    const updated = [{ ...entry, ts: Date.now() }, ...filtered].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (incognito, storage full)
  }
}

export function getRecentItems(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearRecentItems() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
