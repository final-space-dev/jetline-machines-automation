import { NextResponse } from "next/server";
import { syncXeroxStoreMap } from "@/lib/xerox-sync";

export async function POST() {
  try {
    const result = await syncXeroxStoreMap();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[xerox sync-store-map] error:", error);
    return NextResponse.json(
      { error: "Sync failed", detail: String(error) },
      { status: 500 }
    );
  }
}
