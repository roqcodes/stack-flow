export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  activeSubscriptionsCount: number;
  totalCustomersCount: number;
  unpaidInvoicesTotal: number;
  churnRatePercentage: number;
  totalInvoiced: number;
  totalCollected: number;
  overdueInvoicesCount: number;
  upcomingRenewalsCount: number;
}

export interface MonthlyRevenueTrend {
  month: string; // e.g. "May 2026"
  invoiced: number;
  collected: number;
}

export interface FinancialAnalyticsData {
  metrics: RevenueMetrics;
  trends: MonthlyRevenueTrend[];
}
