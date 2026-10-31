import { z } from "zod";

/**
 * Template Module Zod Input Validations
 */

export const createSampleSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  amount: z.number().positive("Amount must be greater than zero"),
});

export const updateSampleSchema = createSampleSchema.partial().extend({
  id: z.string().uuid("Invalid item identifier"),
});

export type CreateSampleInput = z.infer<typeof createSampleSchema>;
export type UpdateSampleInput = z.infer<typeof updateSampleSchema>;
