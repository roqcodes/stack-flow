"use server";

import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createStaffSchema,
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  CreateStaffInput,
} from "./validations";
import { requireRole } from "./auth-utils";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type AuthActionResult = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Public User Registration
 * Enforces server-side password validation and creates customer account.
 */
export async function registerAction(data: RegisterInput): Promise<AuthActionResult> {
  const validation = registerSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: "Validation failed. Please review the errors.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { email, password, fullName, companyName } = validation.data;
  const supabase = await createClient();

  const headerList = await headers();
  const origin = headerList.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/`,
      data: {
        full_name: fullName,
        company_name: companyName,
        // CRITICAL: Even if client injects role: 'admin', the database trigger strictly assigns 'customer'
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Check if email confirmation is required by Supabase
  if (authData.user && !authData.session) {
    return {
      success: true,
      message: "Registration successful! Please check your email to verify your account before logging in.",
    };
  }

  return {
    success: true,
    message: "Registration successful! Welcome to Brightloop.",
  };
}

/**
 * User Login
 */
export async function loginAction(data: LoginInput): Promise<AuthActionResult> {
  const validation = loginSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: "Validation failed. Please provide a valid email and password.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validation.data;
  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Your email address has not been confirmed yet. Please verify your email inbox.",
      };
    }
    return { error: "Invalid email or password credentials." };
  }

  if (!authData.user) {
    return { error: "Authentication failed. Please try again." };
  }

  return {
    success: true,
    message: "Authentication successful.",
  };
}

/**
 * User Logout
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Forgot Password (Request Reset Link)
 */
export async function forgotPasswordAction(data: ForgotPasswordInput): Promise<AuthActionResult> {
  const validation = forgotPasswordSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: "Please enter a valid registered email address.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { email } = validation.data;
  const supabase = await createClient();

  const headerList = await headers();
  const origin = headerList.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: "If an account exists with that email, a secure reset link has been dispatched.",
  };
}

/**
 * Reset Password (Set new password from recovery session)
 */
export async function resetPasswordAction(data: ResetPasswordInput): Promise<AuthActionResult> {
  const validation = resetPasswordSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: "Password policy requirements not satisfied.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { password } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: "Your password has been securely reset. You can now log in.",
  };
}

/**
 * Admin-Only: Assign Staff Role
 */
export async function createStaffAccountAction(data: CreateStaffInput): Promise<AuthActionResult> {
  // Strictly enforce admin role check on server
  await requireRole(["admin"]);

  const validation = createStaffSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: "Invalid staff email provided.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { email } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("assign_staff_role", {
    p_email: email,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: `Staff role granted to ${email}.`,
  };
}
