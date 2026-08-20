import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warn" | "danger" | "info" | "neutral";

const toneClass: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary-strong",
  success: "bg-success-soft text-green-800",
  warn: "bg-warn-soft text-amber-800",
  danger: "bg-danger-soft text-red-800",
  info: "bg-info-soft text-blue-800",
  neutral: "bg-page text-ink-muted border border-line",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}
