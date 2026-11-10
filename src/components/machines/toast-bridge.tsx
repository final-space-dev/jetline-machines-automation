"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { onToast } from "@/lib/toast";

/** Hands every `toast.*()` call (lib/toast) to the kit's toast. Mounted once, inside the Shell. */
export function ToastBridge() {
  const { toast } = useToast();
  React.useEffect(() => onToast((message, kind) => toast(message, kind)), [toast]);
  return null;
}
