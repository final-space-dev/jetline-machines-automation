interface EmptyStateProps {
  title: string;
  /** What this screen will show once it has data (UI rule R15). */
  description: string;
  /** The action or build phase that fills it. */
  hint: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, hint, icon }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        {icon && <div className="mx-auto mb-4 w-10 h-10 text-gray-300">{icon}</div>}
        <h2 className="text-base font-semibold tracking-tight text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-3">{description}</p>
        <p className="text-xs text-gray-400">{hint}</p>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
      <h1 className="text-base font-bold tracking-tight text-gray-900">{title}</h1>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
