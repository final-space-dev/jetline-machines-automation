import { Compass } from "lucide-react";
import { Empty } from "@/components/machines/empty";
import { LinkButton } from "@/components/machines/link-button";
import { SURFACE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/** An address that leads nowhere: say so, and offer the way home. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className={cn(SURFACE.cardRaised, "flex w-full max-w-sm flex-col items-center gap-4 p-7")}>
        <Empty icon={<Compass />} title="This page does not exist" />
        <LinkButton href="/">Back to Machines</LinkButton>
      </div>
    </main>
  );
}
