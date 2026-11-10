/**
 * Which machines have stopped sending readings.
 *
 * Xerox keeps more than one record for some machines (the same serial once as
 * the printer and once as its print server, or an old record beside a new
 * one). Each record has its own readings. A machine is late only when its
 * NEWEST reading, across all of its records, is late: judging each record on
 * its own raised "Critical, last reading 208 days ago" for machines that had
 * reported the day before under their other record.
 */

/** One Xerox record's newest reading. A serial may have several of these. */
export interface LatestReading {
  serial_number: string;
  model: string;
  store: string | null;
  /** "YYYY-MM-DD", or null when the record has never sent a reading. */
  latest_date: string | null;
}

export interface ReadingAlert {
  type: "never_reported" | "critical" | "stale";
  serial_number: string;
  store: string | null;
  model: string;
  detail: string;
  days_since: number | null;
}

const DAY = 86_400_000;
const dayNumber = (isoDay: string) => Math.floor(Date.parse(`${isoDay.slice(0, 10)}T00:00:00Z`) / DAY);

/**
 * The alert feed: machines with no reading at all, then the longest silent
 * first. Stale is over 14 days, critical over 30, as the reading-health
 * figures count them.
 */
export function readingAlerts(records: LatestReading[], today: Date, limit = 50): ReadingAlert[] {
  const todayNumber = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / DAY);

  // One entry per machine: the record with the newest reading speaks for it.
  const newest = new Map<string, LatestReading>();
  for (const r of records) {
    const seen = newest.get(r.serial_number);
    if (!seen || (r.latest_date !== null && (seen.latest_date === null || r.latest_date > seen.latest_date))) {
      newest.set(r.serial_number, r);
    }
  }

  const alerts: ReadingAlert[] = [];
  for (const r of newest.values()) {
    if (r.latest_date === null) {
      alerts.push({ type: "never_reported", serial_number: r.serial_number, store: r.store, model: r.model, detail: "Never sent a reading", days_since: null });
      continue;
    }
    const days = todayNumber - dayNumber(r.latest_date);
    if (days <= 14) continue;
    alerts.push({
      type: days > 30 ? "critical" : "stale",
      serial_number: r.serial_number,
      store: r.store,
      model: r.model,
      detail: `Last reading ${days} days ago`,
      days_since: days,
    });
  }

  alerts.sort((a, b) => {
    if (a.days_since === null || b.days_since === null) return a.days_since === b.days_since ? 0 : a.days_since === null ? -1 : 1;
    return b.days_since - a.days_since;
  });
  return alerts.slice(0, limit);
}

/**
 * One row per machine for a list of printers: where a serial has several
 * records, the one seen most recently is the machine.
 */
export function onePerSerial<T extends { serial_number: string; last_seen: string | null }>(machines: T[]): T[] {
  const best = new Map<string, T>();
  for (const m of machines) {
    const seen = best.get(m.serial_number);
    if (!seen || (m.last_seen !== null && (seen.last_seen === null || m.last_seen > seen.last_seen))) best.set(m.serial_number, m);
  }
  return [...best.values()];
}
