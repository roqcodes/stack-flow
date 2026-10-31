import { cn } from "@/lib/utils";

/** Subtle glass panel — professional, not heavy blur */
export function glassPanel(className?: string) {
  return cn(
    "rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl",
    "shadow-[0_1px_1px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]",
    className
  );
}

export function glassPanelMuted(className?: string) {
  return cn(
    "rounded-2xl border border-slate-200/80 bg-slate-50/80 backdrop-blur-md",
    "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    className
  );
}
