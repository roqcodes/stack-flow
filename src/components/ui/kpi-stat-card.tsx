"use client";

import * as React from "react";
import Link from "next/link";
import { LucideIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { glassPanel } from "@/lib/glass";

export interface KpiTrend {
  value: number;
  label: string;
  direction?: "up" | "down" | "neutral";
}

export interface KpiStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  href?: string;
  trend?: KpiTrend;
  accent?: "blue" | "emerald" | "amber" | "violet" | "slate";
  className?: string;
  delay?: number;
}

const accentMap = {
  blue: "from-blue-500/15 to-blue-600/5 text-blue-600",
  emerald: "from-emerald-500/15 to-emerald-600/5 text-emerald-600",
  amber: "from-amber-500/15 to-amber-600/5 text-amber-600",
  violet: "from-violet-500/15 to-violet-600/5 text-violet-600",
  slate: "from-slate-500/10 to-slate-600/5 text-slate-600",
};

export function KpiStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  trend,
  accent = "blue",
  className,
  delay = 0,
}: KpiStatCardProps) {
  const TrendIcon =
    trend?.direction === "down"
      ? TrendingDown
      : trend?.direction === "up"
        ? TrendingUp
        : Minus;

  const trendColor =
    trend?.direction === "up"
      ? "text-emerald-600 bg-emerald-500/10"
      : trend?.direction === "down"
        ? "text-amber-700 bg-amber-500/10"
        : "text-slate-600 bg-slate-500/10";

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        glassPanel(),
        "group relative overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-0.5",
        href && "cursor-pointer",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-80 blur-2xl",
          accentMap[accent]
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1.5 text-xs text-slate-500 leading-snug">{subtitle}</p>
          ) : null}
          {trend ? (
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                trendColor
              )}
            >
              <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
              <span>
                {trend.value > 0 ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-slate-500 font-normal">{trend.label}</span>
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br border border-white/80 shadow-sm",
            accentMap[accent]
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-2xl">
        {inner}
      </Link>
    );
  }

  return inner;
}
