export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  activeSubscriptionsCount: number;
  totalCustomersCount: number;
  unpaidInvoicesTotal: number;
  churnRatePercentage: number;
}
