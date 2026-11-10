import { TabsList } from "@/components/ui/tabs";

/** The kit's tab list in a strip that scrolls sideways on a narrow screen, so many tabs never widen the page. */
export function TabStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-full min-w-0 overflow-x-auto pb-px">
      <TabsList>{children}</TabsList>
    </div>
  );
}
