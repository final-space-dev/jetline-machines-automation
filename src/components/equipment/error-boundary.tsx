"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/machines/empty";
import { LinkButton } from "@/components/machines/link-button";
import { Page } from "@/components/machines/page";

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Catches a crash inside an equipment screen and offers a retry or the way back. */
export class EquipmentErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Equipment] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Page title="Something went wrong">
        <Empty
          icon={<AlertTriangle />}
          title={this.state.error?.message ?? "An unexpected error occurred in the Equipment section."}
          action={
            <>
              <Button onClick={() => this.setState({ hasError: false, error: null })}>Try again</Button>
              <LinkButton href="/equipment" variant="outline">Back to equipment</LinkButton>
            </>
          }
        />
      </Page>
    );
  }
}
