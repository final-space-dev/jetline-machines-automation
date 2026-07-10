import type { ReactNode } from "react";

export interface JlPageProps {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Page shell. Grey canvas + consistent padding + max width.
 * Renders an h1 title row (title left, actions right), then children.
 * No subtitle support by design.
 */
export function JlPage({ title, actions, children }: JlPageProps) {
  return (
    <div className="jl-page">
      <div className="jl-page__inner">
        <div className="jl-page__head">
          <h1 className="jl-h1">{title}</h1>
          {actions ? <div className="jl-page__actions">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export default JlPage;
