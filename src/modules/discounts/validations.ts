import { z } from "zod";

export const discountSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    code: z
      .string()
      .min(2, "Code must be at least 2 characters")
      .max(50)
      .regex(/^[A-Z0-9_-]+$/, "Code must contain only uppercase letters, numbers, hyphens, and underscores"),
    type: z.enum(["percentage", "fixed_amount"]),
    value: z.number().positive("Value must be greater than zero"),
    currency: z.string().length(3).optional().nullable(),
    max_redemptions: z.number().int().positive().nullable().optional(),
    valid_from: z.string().nullable().optional(),
    valid_until: z.string().nullable().optional(),
    is_active: z.boolean().default(true),
    product_ids: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => {
      if (data.type === "percentage" && data.value > 100) {
        return false;
      }
      return true;
    },
    {
      message: "Percentage discounts cannot exceed 100%",
      path: ["value"],
    }
  );

export type DiscountInput = z.infer<typeof discountSchema>;
