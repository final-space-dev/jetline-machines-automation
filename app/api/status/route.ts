import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';

export const runtime = 'nodejs';

export const GET = async () => {
  const db = getDb();
  const rowCount = db.prepare('SELECT COUNT(*) as count FROM machine_data;').get() as {
    count: number;
  };
  const lastRow = db
    .prepare(
      'SELECT company_schema, reading_date_time FROM machine_data ORDER BY rowid DESC LIMIT 1;'
    )
    .get() as { company_schema?: string; reading_date_time?: string } | undefined;

  return NextResponse.json({
    count: rowCount.count || 0,
    lastCompany: lastRow?.company_schema || null,
    lastReadingTime: lastRow?.reading_date_time || null
  });
};
