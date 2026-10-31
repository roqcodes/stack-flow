import { z } from "zod";

export const billingCycleSchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

export const subscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "paused",
  "cancelled",
  "expired",
]);

export const subscriptionLifecycleStatusSchema = z.enum([
  "draft",
  "quotation",
  "confirmed",
  "active",
  "paused",
  "closed",
]);

export type SubscriptionLifecycleStatusInput = z.infer<
  typeof subscriptionLifecycleStatusSchema
>;

export const transitionSubscriptionLifecycleSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  targetStatus: subscriptionLifecycleStatusSchema,
  reason: z.string().max(500).optional(),
});

export type TransitionSubscriptionLifecycleInput = z.infer<
  typeof transitionSubscriptionLifecycleSchema
>;

export const createSubscriptionFromQuotationSchema = z.object({
  quotationId: z.string().uuid("Invalid quotation ID format"),
  startDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional(),
  overrideCycle: billingCycleSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateSubscriptionFromQuotationInput = z.infer<
  typeof createSubscriptionFromQuotationSchema
>;

export const createDirectSubscriptionSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  planId: z.string().uuid("Invalid plan ID"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").default(1),
  initialStatus: z.enum(["draft", "active"]).default("active"),
  startDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateDirectSubscriptionInput = z.infer<
  typeof createDirectSubscriptionSchema
>;

export const pauseSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  reason: z.string().trim().min(3, "Please provide a reason for pausing (min 3 chars)").max(500),
  resumeScheduledAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional(),
});

export type PauseSubscriptionInput = z.infer<typeof pauseSubscriptionSchema>;

export const resumeSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  resumeBillingNow: z.boolean().default(true),
});

export type ResumeSubscriptionInput = z.infer<typeof resumeSubscriptionSchema>;

export const closeSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  reason: z.string().trim().min(3, "Please provide a reason for cancellation (min 3 chars)").max(500),
  immediately: z.boolean().default(true),
  feedback: z.string().trim().max(1000).optional(),
});

export type CloseSubscriptionInput = z.infer<typeof closeSubscriptionSchema>;

export const submitCancellationRequestSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  immediately: z.boolean().default(false),
  reason: z.string().trim().min(3, "Please provide a cancellation reason (min 3 chars)").max(500),
  feedback: z.string().trim().max(1000).optional(),
});

export type SubmitCancellationRequestInput = z.infer<
  typeof submitCancellationRequestSchema
>;

export const revokeCancellationRequestSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  notes: z.string().trim().max(500).optional(),
});

export type RevokeCancellationRequestInput = z.infer<
  typeof revokeCancellationRequestSchema
>;

export const submitPlanChangeRequestSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  targetPlanId: z.string().uuid("Invalid target plan ID"),
  targetQuantity: z.number().int().min(1, "Quantity must be at least 1").default(1),
  targetCycle: billingCycleSchema.optional(),
  immediately: z.boolean().default(false),
  notes: z.string().trim().max(500).optional(),
});

export type SubmitPlanChangeRequestInput = z.infer<
  typeof submitPlanChangeRequestSchema
>;

export const revokePlanChangeRequestSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  notes: z.string().trim().max(500).optional(),
});

export type RevokePlanChangeRequestInput = z.infer<
  typeof revokePlanChangeRequestSchema
>;

export const renewSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  advancePeriod: z.boolean().default(true),
  idempotencyKey: z.string().max(255).optional(),
  invoiceId: z.string().uuid("Invalid invoice ID").optional(),
  amountPaid: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;

export const dueSubscriptionsOptionsSchema = z.object({
  asOfDate: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
  currency: z.string().length(3).optional(),
});

export type DueSubscriptionsOptionsInput = z.infer<
  typeof dueSubscriptionsOptionsSchema
>;

export const subscriptionFiltersSchema = z.object({
  search: z.string().optional(),
  status: z
    .enum([
      "all",
      "draft",
      "quotation",
      "confirmed",
      "active",
      "paused",
      "closed",
      "trialing",
      "past_due",
      "cancelled",
      "expired",
    ])
    .default("all"),
  billingCycle: z.enum(["all", "daily", "weekly", "monthly", "yearly"]).default("all"),
  customerId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});

export type SubscriptionFiltersInput = z.infer<typeof subscriptionFiltersSchema>;
