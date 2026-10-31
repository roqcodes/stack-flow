import { z } from "zod";

export const taxSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, "Code must contain only uppercase letters, numbers, hyphens, and underscores"),
  country: z
    .string()
    .length(2, "Country must be a 2-letter ISO code (e.g., US, GB, DE)")
    .toUpperCase(),
  state_province: z.string().max(50).nullable().optional(),
  rate: z
    .number()
    .min(0, "Rate cannot be negative")
    .max(100, "Rate cannot exceed 100%"),
  is_compound: z.boolean().default(false),
  is_active: z.boolean().default(true),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
});

export type TaxInput = z.infer<typeof taxSchema>;
