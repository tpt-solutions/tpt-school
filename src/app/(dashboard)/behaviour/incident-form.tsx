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
import { createIncidentAction } from "./actions";

type StudentOption = { id: string; name: string; studentId: string };

export function IncidentForm({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [location, setLocation] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("studentId", studentId);
    formData.set("severity", severity);
    formData.set("location", location);

    startTransition(async () => {
      const result = await createIncidentAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incident Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

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
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-1">
              <Label>Severity *</Label>
              <Select value={severity} onValueChange={(v) => { if (v !== null) setSeverity(v) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Location</Label>
            <Select value={location} onValueChange={(v) => setLocation(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select location…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classroom">Classroom</SelectItem>
                <SelectItem value="playground">Playground</SelectItem>
                <SelectItem value="corridor">Corridor</SelectItem>
                <SelectItem value="canteen">Canteen</SelectItem>
                <SelectItem value="online">Online / Social Media</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={4}
              placeholder="Describe what happened, including context and any contributing factors…"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="witnesses">Witnesses</Label>
            <Input
              id="witnesses"
              name="witnesses"
              placeholder="Names of any witnesses"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="actionTaken">Action Taken</Label>
            <Textarea
              id="actionTaken"
              name="actionTaken"
              rows={2}
              placeholder="Describe any immediate action taken…"
            />
          </div>

          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="parentNotified" className="h-4 w-4" />
              Parent/guardian notified
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="followUpRequired" className="h-4 w-4" />
              Follow-up required
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex gap-3">
        <Button type="submit" disabled={isPending || !studentId}>
          {isPending ? "Saving…" : "Log Incident"}
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
