import { Package } from "lucide-react";
import { Empty } from "@/components/machines/empty";
import { LinkButton } from "@/components/machines/link-button";
import { Page } from "@/components/machines/page";

export default function ItemNotFound() {
  return (
    <Page title="Item not found">
      <Empty icon={<Package />} title="This equipment item may have been deleted or moved" />
      <div className="flex justify-center">
        <LinkButton href="/equipment">Back to Equipment</LinkButton>
      </div>
    </Page>
  );
}
