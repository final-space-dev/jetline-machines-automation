/**
 * Confirmations from anywhere, shown by the kit's toast.
 *
 * Screens call `toast.success("Saved")` or `toast.error("…")` from handlers
 * that are not hooks. The kit's toast is a hook (`useToast`) under the Shell's
 * provider, so this module is the wire between the two: handlers emit here and
 * `ToastBridge` (mounted once inside the Shell) hands each message to the kit.
 * The kit has two kinds, success and info; a refusal is shown as info.
 */
export type ToastKind = "success" | "info";
type Listener = (message: string, kind: ToastKind) => void;

const listeners = new Set<Listener>();
const emit = (message: string, kind: ToastKind) => listeners.forEach((l) => l(message, kind));

export const toast = Object.assign((message: string) => emit(message, "info"), {
  success: (message: string) => emit(message, "success"),
  error: (message: string) => emit(message, "info"),
  info: (message: string) => emit(message, "info"),
  warning: (message: string) => emit(message, "info"),
});

export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
