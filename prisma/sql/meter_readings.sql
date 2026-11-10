-- public.meter_readings: the table the Prisma model MeterReading maps to.
--
-- The Neon database does not have it (found 10 November 2026 on the dev
-- branch, which is a copy of production's), so everything that reads the
-- model through Prisma fails with P2021: /api/machines/utilization (500, the
-- store analysis page), the reading count in /api/health/detailed and in
-- /api/sync, and the BMS sync itself. Live print volumes do not use it; they
-- come from xerox.meter_readings_normalised.
--
-- This is exactly what `prisma migrate diff` prints for the model, made safe
-- to run twice. It only adds: an empty table, its indexes and its foreign key.
-- Applied to the dev branch on 10 November 2026. Production needs the same
-- file run once, by Alwyn's say-so, for those routes to stop failing there.

CREATE TABLE IF NOT EXISTS "meter_readings" (
    "id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "bms_meterreading_id" INTEGER,
    "bms_meterreading_no" TEXT,
    "reading_date" DATE NOT NULL,
    "reading_datetime" TIMESTAMP(3),
    "total" INTEGER NOT NULL DEFAULT 0,
    "a3" INTEGER,
    "black" INTEGER,
    "large" INTEGER,
    "colour" INTEGER,
    "extra_large" INTEGER,
    "incremental_total" INTEGER,
    "incremental_a3" INTEGER,
    "incremental_black" INTEGER,
    "incremental_large" INTEGER,
    "incremental_colour" INTEGER,
    "incremental_xl" INTEGER,
    "is_reported" BOOLEAN NOT NULL DEFAULT false,
    "for_billing" BOOLEAN NOT NULL DEFAULT false,
    "is_opening_reading" BOOLEAN NOT NULL DEFAULT false,
    "is_closing_reading" BOOLEAN NOT NULL DEFAULT false,
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'BMS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "meter_readings_machine_id_idx" ON "meter_readings"("machine_id");
CREATE INDEX IF NOT EXISTS "meter_readings_reading_date_idx" ON "meter_readings"("reading_date");
CREATE INDEX IF NOT EXISTS "meter_readings_machine_id_reading_date_idx" ON "meter_readings"("machine_id", "reading_date");
CREATE UNIQUE INDEX IF NOT EXISTS "meter_readings_machine_id_reading_date_bms_meterreading_id_key" ON "meter_readings"("machine_id", "reading_date", "bms_meterreading_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meter_readings_machine_id_fkey') THEN
    ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_machine_id_fkey"
      FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
