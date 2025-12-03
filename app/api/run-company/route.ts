import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { companies } from '@/lib/companies';
import { MACHINE_QUERY, mapMachineRow } from '@/lib/query';
import { insertMachineRows, resetMachineData } from '@/lib/sqlite';

export const runtime = 'nodejs';

type Body = {
  schema?: string;
  truncate?: boolean;
};

const MYSQL_USER = process.env.MACHINE_DB_USER || 'fortyone';
const MYSQL_PASSWORD = process.env.MACHINE_DB_PASSWORD || 'fo123@!';

export const POST = async (request: Request) => {
  try {
    const body: Body = await request.json();
    const target = companies.find((c) => c.schema === body.schema);

    if (!target || target.switch !== 'ON') {
      return NextResponse.json(
        { error: 'Unknown or disabled company schema.' },
        { status: 400 }
      );
    }

    if (body.truncate) {
      resetMachineData();
    }

    const connection = await mysql.createConnection({
      host: target.host,
      port: target.port,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: target.schema,
      connectTimeout: 10000
    });

    const [rows] = await connection.execute(MACHINE_QUERY, [
      target.schema,
      target.schema,
      target.schema
    ]);

    await connection.end();

    const prepared = Array.isArray(rows)
      ? rows.map((row) => mapMachineRow(row as any))
      : [];

    const inserted = insertMachineRows(prepared);

    return NextResponse.json({
      company: target.schema,
      name: target.name,
      inserted
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
