import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-semibold text-ink-muted", className)}
      {...props}
    />
  );
}

const inputBase =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-2 focus:outline-primary/25 disabled:cursor-not-allowed disabled:bg-page";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputBase, "h-10", className)} {...props} />;
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(inputBase, "h-10", className)} {...props} />;
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputBase, "min-h-20 py-2", className)} {...props} />;
  }
);

export function FieldHint({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "danger" | "warn" }) {
  return (
    <p
      className={cn(
        "mt-1 text-xs",
        tone === "muted" && "text-ink-faint",
        tone === "danger" && "font-semibold text-danger",
        tone === "warn" && "font-semibold text-warn"
      )}
    >
      {children}
    </p>
  );
}
