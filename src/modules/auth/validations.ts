import { z } from "zod";

/**
 * Enterprise Password Policy:
 * - More than 8 characters (at least 9 characters)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(9, "Password must be more than 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character (!@#$%^&*...)");

export const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid business email"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
    companyName: z.string().trim().min(2, "Company name must be at least 2 characters"),
    email: z.string().trim().email("Please provide a valid business email"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please provide a valid registered email"),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createStaffSchema = z.object({
  email: z.string().trim().email("Please provide a valid email to elevate to staff"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
