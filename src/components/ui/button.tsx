import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger" | "success" | "soft";
type Size = "sm" | "md" | "lg" | "xl";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-strong shadow-sm disabled:opacity-50",
  outline:
    "border border-line bg-surface text-ink hover:border-primary hover:text-primary disabled:opacity-50",
  ghost: "text-ink-muted hover:bg-primary-soft hover:text-primary disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-red-700 shadow-sm disabled:opacity-50",
  success: "bg-success text-white hover:bg-green-700 shadow-sm disabled:opacity-50",
  soft: "bg-primary-soft text-primary-strong hover:bg-primary hover:text-primary-fg disabled:opacity-50",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
  xl: "h-14 px-6 text-base", // tombol besar utk layar sentuh kasir (≥44px)
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:active:scale-100",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  );
}

/** Link yang tampil seperti tombol. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    variantClass[variant],
    sizeClass[size],
    className
  );
}
