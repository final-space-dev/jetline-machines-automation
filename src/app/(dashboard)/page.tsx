import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

/**
 * App landing. Admins land on All Stores (the full fleet). Store staff land
 * straight on their own store — they're a single-store tenant and never see the
 * fleet-wide view.
 */
export default async function HomePage() {
  const user = await getSessionUser();
  if (user && user.role !== "admin" && user.store) {
    redirect(`/equipment/stores/${encodeURIComponent(user.store)}`);
  }
  redirect("/equipment");
}
