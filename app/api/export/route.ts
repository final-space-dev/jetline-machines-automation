import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';

export const runtime = 'nodejs';

const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))
  ];
  return lines.join('\n');
};

export const GET = async () => {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM machine_data ORDER BY company_schema, reading_date DESC;'
  );
  const rows = stmt.all();
  const csv = toCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="machine-data.csv"'
    }
  });
};
