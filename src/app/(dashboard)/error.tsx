"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/machines/empty";
import { LinkButton } from "@/components/machines/link-button";
import { Page } from "@/components/machines/page";

/** A screen that crashed: the menu stays, the screen says so and offers a retry. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Machines] A screen failed:", error);
  }, [error]);

  return (
    <Page title="Something went wrong">
      <Empty icon={<AlertTriangle />} title="This screen could not be shown. Try again, or go back to the start." />
      <div className="flex justify-center gap-2.5">
        <Button onClick={() => reset()}>Try again</Button>
        <LinkButton href="/" variant="outline">Back to the start</LinkButton>
      </div>
    </Page>
  );
}
