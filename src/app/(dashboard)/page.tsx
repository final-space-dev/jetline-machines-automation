import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { firstAllowedPath } from "@/lib/permissions";

/**
 * App landing. Admins land on All Stores (the full fleet). Store staff land
 * straight on their own store. Custom users land on their first granted page.
 */
export default async function HomePage() {
  const user = await getSessionUser();
  if (user && user.role === "store_staff" && user.store) {
    redirect(`/equipment/stores/${encodeURIComponent(user.store)}`);
  }
  if (user && user.role === "custom") {
    redirect(firstAllowedPath(user.permissions));
  }
  redirect("/equipment");
}
