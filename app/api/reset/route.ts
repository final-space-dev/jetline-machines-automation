import { NextResponse } from 'next/server';
import { resetMachineData } from '@/lib/sqlite';

export const runtime = 'nodejs';

export const POST = async () => {
  resetMachineData();
  return NextResponse.json({ ok: true });
};
