"use client";

import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { Page } from "@/components/machines/page";
import { Muted, Panel, SectionHeading } from "@/components/machines/panel";

// Account page. Shows the signed-in user. There is no endpoint for changing
// one's own password yet, so the page says who can set one instead of showing
// a form that does nothing.
export default function AccountPage() {
  // useSession() can return undefined during static prerender (no SessionProvider
  // in the tree at build time), so guard the same way lib/use-role.ts does.
  const session = useSession();
  const user = session?.data?.user;
  const name = user?.name || "";
  const email = user?.email || "";

  return (
    <Page title="Account">
      <div className="flex w-full max-w-xl flex-col gap-5">
        <Panel>
          <div className="flex items-center gap-4 pt-1">
            <Avatar name={name || email || "?"} size="lg" />
            <div className="flex min-w-0 flex-col">
              <SectionHeading>{name || "Signed-in user"}</SectionHeading>
              {email && <Muted>{email}</Muted>}
            </div>
          </div>
        </Panel>
        <Panel caption="Password">
          {/* A password is set by an administrator; there is no self-service change yet. */}
          <Muted>To change your password, ask an administrator to set a new one for you under Config, Users.</Muted>
        </Panel>
      </div>
    </Page>
  );
}
