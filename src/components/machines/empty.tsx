import { EmptyState } from "@/components/ui/empty-state";

/** The kit's EmptyState, title only: headings stand alone, so its description and hint stay empty. */
export function Empty({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return <EmptyState title={title} description="" hint="" icon={icon} />;
}
