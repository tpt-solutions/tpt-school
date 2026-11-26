"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDemoDataAction } from "./demo-data-actions";

export default function DemoDataForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function handleLoad() {
    if (!window.confirm("Load demo students, a demo teacher and demo classes into this school?")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await loadDemoDataAction();
      if (result.success) {
        setMessage({ kind: "ok", text: result.summary ?? "Demo data loaded." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error ?? "Could not load demo data." });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demo data</CardTitle>
        <CardDescription>
          Adds a few obviously fake students, a teacher and two classes so you can try the system. Only available while the
          school has no students or staff. Demo accounts get random passwords, so they cannot be signed in to. Deactivate them
          from Students when you are done.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {message && (
          <p role="status" className={message.kind === "ok" ? "rounded bg-green-50 p-2 text-sm text-green-700" : "rounded bg-red-50 p-2 text-sm text-red-600"}>
            {message.text}
          </p>
        )}
        <Button type="button" variant="outline" onClick={handleLoad} disabled={isPending}>
          {isPending ? "Loading…" : "Load demo data"}
        </Button>
      </CardContent>
    </Card>
  );
}
