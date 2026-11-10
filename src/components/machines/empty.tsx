import { EmptyState } from "@/components/ui/empty-state";

/**
 * Nothing here: the kit's EmptyState with a title only (headings stand alone,
 * so its description and hint stay empty). `action` sits right under the
 * words, so the way out is beside the message and not at the foot of the page.
 */
export function Empty({ title, icon, action }: { title: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8">
      <div className="flex w-full">
        <EmptyState title={title} description="" hint="" icon={icon} />
      </div>
      {action && <div className="flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}
