"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export type ActionResult = { success: boolean; error?: string };

/**
 * Generic client form for the operational modules. The server action receives one
 * FormData; ids for row-level actions go in `hidden`, so no bound functions cross the boundary.
 */
export function ActionForm({
  action,
  submitLabel,
  hidden,
  children,
  variant = "default",
  resetOnSuccess = true,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | "ghost";
  resetOnSuccess?: boolean;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    const formData = new FormData(e.currentTarget);
    for (const [k, v] of Object.entries(hidden ?? {})) formData.set(k, v);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      if (resetOnSuccess) formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {children}
      {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <Button type="submit" variant={variant} size="sm" disabled={isPending}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

/** Shared class names for native form controls, matching the shadcn input look. */
export const controlClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
