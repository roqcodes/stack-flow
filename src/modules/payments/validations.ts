import { z } from "zod";

export const recordPaymentSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  amount: z
    .number()
    .positive("Payment amount must be greater than zero"),
  currency: z.string().length(3).default("USD"),
  paymentMethodType: z.enum([
    "credit_card",
    "bank_transfer",
    "ach",
    "wire",
    "manual",
  ]),
  subChannel: z.enum(["upi", "cash", "card", "wire", "ach", "other"]).optional(),
  transactionReference: z.string().max(100).optional(),
  invoiceAllocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid("Invalid invoice ID"),
        amount: z.number().positive("Allocation amount must be greater than zero"),
      })
    )
    .optional(),
});

export const refundPaymentSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID"),
  amount: z.number().positive("Refund amount must be greater than zero"),
  reason: z.string().max(255).optional(),
});
