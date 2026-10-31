import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with Tailwind conflict resolution
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats financial amounts strictly according to enterprise decimal precision (NUMERIC(14,2))
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "$0.00";
  }

  const numericValue = typeof amount === "string" ? parseFloat(amount) : amount;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

/**
 * Formats dates consistently across server and client
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return "—";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "Invalid Date";

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  };

  return new Intl.DateTimeFormat("en-US", defaultOptions).format(date);
}

/**
 * Formats standard numbers with grouping
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return "0";
  }

  const numericValue = typeof value === "string" ? parseFloat(value) : value;

  return new Intl.NumberFormat("en-US", options).format(numericValue);
}

/**
 * Formats a billing period display (e.g. "Oct 1, 2026 – Oct 31, 2026")
 */
export function formatBillingPeriod(startDate: string | Date, endDate: string | Date): string {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

/**
 * Helper to map domain entity statuses to UI badge variant tokens
 */
export function getStatusBadgeVariant(status: string): "default" | "secondary" | "success" | "warning" | "destructive" | "outline" {
  const normalized = status.toLowerCase().trim();

  switch (normalized) {
    case "active":
    case "paid":
    case "succeeded":
    case "accepted":
      return "success";

    case "trialing":
    case "partially_paid":
    case "partially_refunded":
    case "sent":
    case "issued":
      return "secondary";

    case "pending":
    case "past_due":
    case "paused":
    case "draft":
      return "warning";

    case "failed":
    case "cancelled":
    case "expired":
    case "rejected":
    case "void":
    case "uncollectible":
    case "suspended":
      return "destructive";

    case "archived":
    default:
      return "outline";
  }
}
