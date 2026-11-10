import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { getBrand, splitBrandName } from "@/lib/brand";
import { CHROME, SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { LoginForm } from "./login-form";

/** Sign in: the product's name, the DEV mark on anything that is not production, and the form. */
export default function LoginPage() {
  const brand = getBrand();
  const { lead, accent } = splitBrandName(brand.name);
  const dev = process.env.VERCEL_ENV !== "production";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className={cn(SURFACE.cardRaised, "flex w-full max-w-sm flex-col gap-6 p-7")}>
        <div className="flex items-center justify-center gap-2">
          <span className={cn(TYPE.display, "font-bold tracking-tight")}>{accent ? lead : brand.name}</span>
          {accent && <span className={cn(CHROME.accent, TYPE.section, "rounded-lg px-2.5 py-0.5 text-primary-foreground")}>{accent}</span>}
          {dev && <Badge status="warning">DEV</Badge>}
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
