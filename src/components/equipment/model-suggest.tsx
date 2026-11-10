"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";

interface ModelSuggestProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * Optional equipment type filter. When provided, only catalogue models of
   * this equipment_type are suggested (passed as &type=<equipmentType>).
   * When omitted, all models are suggested.
   */
  equipmentType?: string;
  /**
   * Data source. Defaults to the models catalogue. Set `source="suppliers"` to
   * suggest from /api/setup/suppliers instead (same behaviour; used by the supplier
   * fields on equipment and printer pages). Free text is kept through "Add new …".
   */
  source?: "models" | "suppliers";
}

/**
 * A searchable pick that also takes free text: the kit SearchSelect over a
 * list endpoint. Typing waits 300 ms and queries the endpoint; if the typed
 * term is not an exact match, "Add new …: <term>" accepts it as typed.
 * Defaults to the make/model catalogue (GET /api/equipment/models?q=…);
 * `source="suppliers"` uses the suppliers list.
 */
export function ModelSuggest({
  value,
  onChange,
  placeholder = "Make / Model",
  className,
  equipmentType,
  source = "models",
}: ModelSuggestProps) {
  const noun = source === "suppliers" ? "supplier" : "model";
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<string[]>([]);

  const term = query.trim();
  const type = (equipmentType ?? "").trim();

  // Debounced fetch (300ms). Models endpoint returns { models: string[] };
  // suppliers endpoint returns { rows: [{ name }] }: normalise both to names,
  // then filter suppliers client-side by the term (the list is small).
  useEffect(() => {
    let alive = true;
    const handle = setTimeout(() => {
      if (source === "suppliers") {
        fetch(`/api/setup/suppliers`)
          .then((r) => (r.ok ? r.json() : { rows: [] }))
          .then((d: { rows?: { name: string }[] }) => {
            if (!alive) return;
            const names = Array.isArray(d.rows) ? d.rows.map((x) => x.name).filter(Boolean) : [];
            const t = term.toLowerCase();
            setModels(t ? names.filter((n) => n.toLowerCase().includes(t)) : names);
          })
          .catch(() => { if (alive) setModels([]); });
      } else {
        const params = new URLSearchParams({ q: term });
        if (type) params.set("type", type);
        fetch(`/api/equipment/models?${params.toString()}`)
          .then((r) => (r.ok ? r.json() : { models: [] }))
          .then((d: { models?: string[] }) => { if (alive) setModels(Array.isArray(d.models) ? d.models : []); })
          .catch(() => { if (alive) setModels([]); });
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [term, type, source]);

  const options = useMemo<SearchOption[]>(() => {
    const out: SearchOption[] = models.map((m) => ({ value: m, label: m }));
    const has = (v: string) => models.some((m) => m.toLowerCase() === v.toLowerCase());
    // The current value always has a row, so the trigger can show it.
    if (value && !has(value)) out.unshift({ value, label: value });
    if (term && !has(term) && term.toLowerCase() !== value.toLowerCase()) out.push({ value: term, label: `Add new ${noun}: ${term}` });
    return out;
  }, [models, value, term, noun]);

  return (
    <SearchSelect
      options={options}
      value={value || null}
      onChange={onChange}
      onQueryChange={setQuery}
      placeholder={placeholder}
      searchPlaceholder={`Search or add a ${noun}`}
      className={className ?? "h-9 w-full"}
    />
  );
}
