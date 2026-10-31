/**
 * Template Module Types
 */

export type SampleStatus = "active" | "draft" | "archived";

export interface SampleItem {
  id: string;
  name: string;
  status: SampleStatus;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface SampleFilters {
  search?: string;
  status?: SampleStatus | "all";
  page?: number;
  pageSize?: number;
}
