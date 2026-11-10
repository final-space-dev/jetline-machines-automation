import { Printer } from "lucide-react";
import { Empty } from "@/components/machines/empty";
import { LinkButton } from "@/components/machines/link-button";
import { Page } from "@/components/machines/page";

export default function PrinterNotFound() {
  return (
    <Page title="Printer not found">
      <Empty icon={<Printer />} title="This printer may have been removed or its serial changed" />
      <div className="flex justify-center">
        <LinkButton href="/equipment">Back to Equipment</LinkButton>
      </div>
    </Page>
  );
}
