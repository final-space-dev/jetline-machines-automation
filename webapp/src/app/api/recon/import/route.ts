import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

/**
 * Derive billing month (actual usage month) from invoice month.
 * Xerox bills in arrears: Nov usage is billed Dec, so billingMonth = invoiceMonth - 1.
 */
function getBillingMonth(invoiceMonth: string): string {
  const [year, month] = invoiceMonth.split("-").map(Number);
  const d = new Date(year, month - 2, 1); // month-2 because Date months are 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Parse an Excel date serial number to a JS Date.
 */
function parseExcelDate(val: unknown): Date | null {
  if (val == null) return null;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === "string" && val.trim()) {
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toDecimalOrNull(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toIntOrNull(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.round(n);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer);

    // Build machine lookup by serial number
    const machines = await prisma.machine.findMany({
      select: { id: true, serialNumber: true },
    });
    const machineBySerial = new Map(machines.map((m) => [m.serialNumber, m.id]));

    let sheetsProcessed = 0;
    let recordsUpserted = 0;
    const unmatchedSerials = new Set<string>();

    for (const sheetName of wb.SheetNames) {
      // Skip legend/helper sheets (Sheet1 etc)
      if (sheetName.toLowerCase().startsWith("sheet")) continue;

      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      if (rows.length === 0) continue;

      // Determine invoice month from first row with data
      let invoiceMonth: string | null = null;
      for (const row of rows) {
        const im = String(row["Invoice Month"] ?? "").trim();
        if (im && /^\d{4}-\d{2}$/.test(im)) {
          invoiceMonth = im;
          break;
        }
      }

      if (!invoiceMonth) {
        console.warn(`Sheet "${sheetName}": Could not determine invoice month, skipping`);
        continue;
      }

      const billingMonth = getBillingMonth(invoiceMonth);
      sheetsProcessed++;

      // Collect records for this sheet
      const records: Parameters<typeof prisma.xeroxBilling.upsert>[0][] = [];

      // Track line indices per serial+printType to handle duplicates (e.g. two A3 Color rows)
      const lineIndexCounters = new Map<string, number>();

      for (const row of rows) {
        const serial = String(row["Serial Number"] ?? "").trim();
        if (!serial) continue; // Skip header rows without serial

        const printType = String(row["Print Type"] ?? "").trim();
        // "Charge Item" column contains the BMS counter mapping key (e.g. "Black Impressions", "Color Large Impressions")
        // "Line Description" column contains useless text like "Meter Tier # 1"
        const lineDescription = row["Charge Item"] ? String(row["Charge Item"]).trim() : null;
        const machineId = machineBySerial.get(serial) ?? null;
        if (!machineId) unmatchedSerials.add(serial);

        // Assign lineIndex: 0 for first occurrence, 1 for second, etc.
        const counterKey = `${serial}|${billingMonth}|${printType}`;
        const lineIndex = lineIndexCounters.get(counterKey) ?? 0;
        lineIndexCounters.set(counterKey, lineIndex + 1);

        const rental = toDecimalOrNull(row["Rental"]);
        const fixedCharge = toDecimalOrNull(row["Fixed Charge"]);
        const otherCharge = toDecimalOrNull(row["Other Charge"]);
        const volumeCharges = toDecimalOrNull(row["Volume Charges"]);
        const totalCharges =
          (rental ?? 0) + (fixedCharge ?? 0) + (otherCharge ?? 0) + (volumeCharges ?? 0);

        const data = {
          serialNumber: serial,
          billingMonth,
          printType,
          lineDescription,
          lineIndex,
          invoiceMonth,
          invoiceDate: parseExcelDate(row["Invoice Date"]),
          invoiceNumber: row["Invoice Number"] ? String(row["Invoice Number"]).trim() : null,
          contractNumber: row["Contract Number"] ? String(row["Contract Number"]).trim() : null,
          contractStartDate: parseExcelDate(row["Contract Start Date"]),
          contractEndDate: parseExcelDate(row["Contract End Date"]),
          contractStatus: row["Current Contract Status"]
            ? String(row["Current Contract Status"]).trim()
            : null,
          product: row["Product"] ? String(row["Product"]).trim() : null,
          customer: row["Customer"] ? String(row["Customer"]).trim() : null,
          customerAccount: row["Customer Account"]
            ? String(row["Customer Account"]).trim()
            : null,
          siteCustomer: row["Site Customer"] ? String(row["Site Customer"]).trim() : null,
          locationAddress: row["Location Address"]
            ? String(row["Location Address"]).trim()
            : null,
          rental,
          fixedCharge,
          otherCharge,
          volumeCharges,
          totalCharges,
          readingDate: parseExcelDate(row["Reading Date"]),
          currentReading: toIntOrNull(row["Current Reading"]),
          previousReading: toIntOrNull(row["Previous Reading"]),
          volumeA4Mono: toIntOrNull(row["A4 Mono"]),
          volumeA3Mono: toIntOrNull(row["A3 Mono"]),
          volumeA4Color: toIntOrNull(row["A4 Color"]),
          volumeA3Color: toIntOrNull(row["A3 Color"]),
          totalClicks: toIntOrNull(row["Total Clicks"]),
          cpc: toDecimalOrNull(row["C P C"]) ?? toDecimalOrNull(row["CPC"]),
          coverageFrom: parseExcelDate(row["Coverage From"]),
          coverageTo: parseExcelDate(row["Coverage To"]),
          machineId,
        };

        records.push({
          where: {
            xerox_billing_unique: { serialNumber: serial, billingMonth, printType, lineIndex },
          },
          create: data,
          update: data,
        });
      }

      // Upsert in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(batch.map((r) => prisma.xeroxBilling.upsert(r)));
        recordsUpserted += batch.length;
      }
    }

    return NextResponse.json({
      sheetsProcessed,
      recordsUpserted,
      unmatchedSerials: Array.from(unmatchedSerials),
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 },
    );
  }
}
