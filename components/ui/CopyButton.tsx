"use client";

import { Copy } from "lucide-react";
import { useToast } from "./ToastProvider";

export function CopyButton({ value, label = "Copied" }: { value: string; label?: string }) {
  const toast = useToast();

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        toast(label);
      }}
      title="Copy"
      className="flex items-center justify-center size-7 rounded-md text-text-muted hover:bg-bg-subtle hover:text-text-body transition-colors shrink-0"
    >
      <Copy className="size-3.5" />
    </button>
  );
}
