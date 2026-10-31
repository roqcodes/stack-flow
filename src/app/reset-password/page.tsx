"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { resetPasswordAction } from "@/modules/auth/actions";
import { Zap, Check, X, ShieldCheck } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const checks = {
    length: password.length > 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasSpecial: /[^a-zA-Z0-9]/.test(password),
  };

  const isPasswordValid = Object.values(checks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (!isPasswordValid) {
      toastError("Please satisfy all password security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: ["Passwords do not match"] });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await resetPasswordAction({
        password,
        confirmPassword,
      });

      if (result.error) {
        toastError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        toastSuccess("Your password has been securely reset.", "Password Updated");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      }
    } catch {
      toastError("Failed to reset password. The recovery link may have expired.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Brand Heading */}
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md mb-3">
          <Zap className="h-6 w-6 fill-current" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Create New Password
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Brightloop Security & Identity Services
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Update Credentials</CardTitle>
          <CardDescription>
            Choose a strong password compliant with platform security policies.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Input
              id="reset-password"
              type="password"
              label="New Password"
              placeholder="••••••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password?.[0]}
              disabled={isSubmitting}
            />

            {/* Checklist */}
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1.5">
              <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                Required Security Elements:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600">
                <div className="flex items-center gap-1.5">
                  {checks.length ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                  <span className={checks.length ? "text-slate-900 font-medium" : ""}>More than 8 chars</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.hasUpper ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                  <span className={checks.hasUpper ? "text-slate-900 font-medium" : ""}>Uppercase (A-Z)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.hasLower ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                  <span className={checks.hasLower ? "text-slate-900 font-medium" : ""}>Lowercase (a-z)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.hasSpecial ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                  <span className={checks.hasSpecial ? "text-slate-900 font-medium" : ""}>Special symbol</span>
                </div>
              </div>
            </div>

            <Input
              id="reset-confirm-password"
              type="password"
              label="Confirm New Password"
              placeholder="••••••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirmPassword?.[0]}
              disabled={isSubmitting}
            />
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Update Password
            </Button>

            <div className="text-center text-xs text-slate-500">
              <Link href="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
                Cancel and return to sign in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>

      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>End-to-end encrypted password update via Supabase Auth</span>
      </div>
    </div>
  );
}
