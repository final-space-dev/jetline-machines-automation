import { prisma } from "@/lib/prisma";
import { xeroxPool } from "@/lib/xerox-pool";

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
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
    // Chunk at 500 rows (4 params each = 2000 params per batch, well under 65535 limit)
    const batches = chunkArray(machines, 500);
    let totalUpserted = 0;

    for (const batch of batches) {
      const values = batch.map((_, i) => {
        const base = i * 3;
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      });
      const params = batch.flatMap((m) => [
        m.serialNumber,
        m.company?.name ?? null,
        m.company?.companyGroup ?? null,
      ]);

      await client.query(
        `INSERT INTO xerox.printer_store_map (serial_number, store, company_group)
         VALUES ${values.join(", ")}
         ON CONFLICT (serial_number) DO UPDATE SET
           store         = EXCLUDED.store,
           company_group = EXCLUDED.company_group,
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
