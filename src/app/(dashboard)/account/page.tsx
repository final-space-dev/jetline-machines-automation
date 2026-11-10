"use client";

import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/machines/field";
import { Page } from "@/components/machines/page";
import { Muted, Panel, SectionHeading } from "@/components/machines/panel";

// Account page. Shows the signed-in user and the change-password form. The
// submit is wired together with its backend endpoint in a later phase, so the
// fields stay disabled here rather than pretending to change a password.
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
        <Panel caption="Change password">
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <Field label="Current password" htmlFor="acc-current">
              <PasswordInput id="acc-current" autoComplete="current-password" disabled />
            </Field>
            <Field label="New password" htmlFor="acc-new">
              <PasswordInput id="acc-new" autoComplete="new-password" disabled />
            </Field>
            <Field label="Confirm new password" htmlFor="acc-confirm" hint="Password changes will be enabled in an upcoming release.">
              <PasswordInput id="acc-confirm" autoComplete="new-password" disabled />
            </Field>
            <div>
              <Button type="submit" disabled>
                Update password
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </Page>
  );
}
