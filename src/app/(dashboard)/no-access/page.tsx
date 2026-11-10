import { Lock } from "lucide-react";
import { Empty } from "@/components/machines/empty";
import { Page } from "@/components/machines/page";

/**
 * Shown to a signed-in "custom" user who holds no grants yet (an admin created
 * the account but has not ticked any menu or config access). Not an error: it
 * tells them to contact an administrator.
 */
export default function NoAccessPage() {
  return (
    <Page title="No access yet">
      <Empty icon={<Lock />} title="Your account has no sections enabled. Ask an administrator to grant you access." />
    </Page>
  );
}
