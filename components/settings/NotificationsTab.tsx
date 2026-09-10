"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

const LEAD_OPTIONS = [
  { value: 24, label: "24 hours before" },
  { value: 48, label: "48 hours before" },
  { value: 72, label: "3 days before" },
  { value: 168, label: "1 week before" },
];

export function NotificationsTab({
  alertsEnabled: initialEnabled,
  alertLeadHours: initialLeadHours,
}: {
  alertsEnabled: boolean;
  alertLeadHours: number;
}) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [leadHours, setLeadHours] = useState(initialLeadHours);
  const [saving, setSaving] = useState(false);

  async function update(next: { alertsEnabled?: boolean; alertLeadHours?: number }) {
    setSaving(true);
    try {
      const res = await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error();
      toast("Preferences saved");
    } catch {
      toast("Failed to save preferences", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-md">
      <h2 className="text-base font-semibold text-text-primary">Notifications</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-body">Deadline alerts</p>
          <p className="text-xs text-text-muted mt-0.5">
            Get an email summary when assignments are coming due.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            update({ alertsEnabled: next });
          }}
          disabled={saving}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            enabled ? "bg-accent" : "bg-bg-subtle border border-border-strong"
          )}
        >
          <span
            className={cn(
              "inline-block size-4 transform rounded-full bg-white transition-transform shadow-card",
              enabled ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      <div className={cn("flex flex-col gap-1.5", !enabled && "opacity-50 pointer-events-none")}>
        <label className="text-sm font-medium text-text-body">Lead time</label>
        <select
          value={leadHours}
          onChange={(e) => {
            const next = Number(e.target.value);
            setLeadHours(next);
            update({ alertLeadHours: next });
          }}
          disabled={!enabled || saving}
          className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {LEAD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
