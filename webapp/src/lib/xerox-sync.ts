import { prisma } from "@/lib/prisma";
import { xeroxPool } from "@/lib/xerox-pool";

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Map BMS category name → display label
function categoryToType(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("colour") || n.includes("color")) return "Colour";
  if (n.includes("black")) return "B&W";
  if (n.includes("plan")) return "Plan";
  return name;
}

export async function syncXeroxStoreMap(): Promise<{ upserted: number; duration: number }> {
  const start = Date.now();

  const machines = await prisma.machine.findMany({
    select: {
      serialNumber: true,
      company: {
        select: {
          name: true,
          companyGroup: true,
        },
      },
      category: {
        select: { name: true },
      },
    },
    where: {
      serialNumber: { not: "" },
    },
  });

  if (machines.length === 0) {
    return { upserted: 0, duration: Date.now() - start };
  }

  const client = await xeroxPool.connect();
  try {
    const batches = chunkArray(machines, 500);
    let totalUpserted = 0;

    for (const batch of batches) {
      const values = batch.map((_, i) => {
        const base = i * 4;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      });
      const params = batch.flatMap((m) => [
        m.serialNumber,
        m.company?.name ?? null,
        m.company?.companyGroup ?? null,
        categoryToType(m.category?.name),
      ]);

      await client.query(
        `INSERT INTO xerox.printer_store_map (serial_number, store, company_group, printer_type)
         VALUES ${values.join(", ")}
         ON CONFLICT (serial_number) DO UPDATE SET
           store         = EXCLUDED.store,
           company_group = EXCLUDED.company_group,
           printer_type  = EXCLUDED.printer_type,
           updated_at    = now()`,
        params
      );
      totalUpserted += batch.length;
    }

    return { upserted: totalUpserted, duration: Date.now() - start };
  } finally {
    client.release();
  }
}
