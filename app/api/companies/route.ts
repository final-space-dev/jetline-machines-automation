import { NextResponse } from 'next/server';
import { companies, getActiveCompanies } from '@/lib/companies';

export const runtime = 'nodejs';

export const GET = async () => {
  const active = getActiveCompanies();
  return NextResponse.json({
    companies: active,
    total: companies.length,
    activeCount: active.length
  });
};
