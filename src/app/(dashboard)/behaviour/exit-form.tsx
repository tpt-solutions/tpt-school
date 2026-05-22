"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { exitStudentAction } from "./actions";

type StudentOption = { id: string; name: string; studentId: string };

export function ExitForm({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [exitType, setExitType] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("studentId", studentId);
    formData.set("exitType", exitType);

    startTransition(async () => {
      const result = await exitStudentAction(formData);
      if (result?.success) {
        setSuccess(true);
        setTimeout(() => router.push("/students"), 2000);
      } else {
        setError(result?.error ?? "An error occurred");
      }
    });
  }

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-8 text-center">
          <p className="text-lg font-medium text-green-800">
            Student exit processed successfully.
          </p>
          <p className="mt-1 text-sm text-green-600">
            Redirecting to student list…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exit Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Note:</strong> This action will deactivate the student&apos;s
            account and update their enrolment status. This cannot be undone
            without admin intervention.
          </div>

          <div className="space-y-1">
            <Label>Student *</Label>
            <Select value={studentId} onValueChange={(v) => { if (v !== null) setStudentId(v) }} required>
              <SelectTrigger>
                <SelectValue placeholder="Select student…" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.studentId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Exit Type *</Label>
              <Select value={exitType} onValueChange={(v) => { if (v !== null) setExitType(v) }} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="withdrawn">Withdrawn by family</SelectItem>
                  <SelectItem value="transferred">
                    Transferred to another school
                  </SelectItem>
                  <SelectItem value="expelled">Expelled</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="exitDate">Exit Date *</Label>
              <Input
                id="exitDate"
                name="exitDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          {exitType === "transferred" && (
            <div className="space-y-1">
              <Label htmlFor="destinationSchool">Destination School</Label>
              <Input
                id="destinationSchool"
                name="destinationSchool"
                placeholder="Name of the school they are transferring to"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="reason">Reason / Notes</Label>
            <Textarea
              id="reason"
              name="reason"
              rows={3}
              placeholder="Provide context for this exit…"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="documentsIssued"
              className="h-4 w-4"
            />
            School leaver documents have been issued
          </label>
        </CardContent>
      </Card>

      <div className="mt-4 flex gap-3">
        <Button
          type="submit"
          variant="destructive"
          disabled={isPending || !studentId || !exitType}
        >
          {isPending ? "Processing…" : "Confirm Exit"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
