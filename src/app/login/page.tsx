"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { loginAction } from "@/modules/auth/actions";
import { Zap, ShieldCheck, ArrowRight, Lock } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Check for error parameters in query string (e.g. from callback or session timeout)
  React.useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      toastError(decodeURIComponent(errorParam));
    }
  }, [searchParams, toastError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const result = await loginAction({ email, password });

      if (result.error) {
        toastError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        toastSuccess("Authentication verified. Loading dashboard...", "Welcome Back");
        const redirectTo = searchParams.get("redirectTo") || "/";
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      toastError("An unexpected error occurred during sign in. Please retry.");
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
          Sign in to Brightloop
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Enterprise Subscription Lifecycle & Recurring Billing Monolith
        </p>
      </div>

      {/* Login Card */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Account Login</CardTitle>
          <CardDescription>
            Enter your credentials to access your organization dashboard.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Input
              id="login-email"
              type="email"
              label="Business Email"
              placeholder="name@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email?.[0]}
              disabled={isSubmitting}
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password?.[0]}
                disabled={isSubmitting}
                leftAddon={<Lock className="h-4 w-4" />}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Sign In
            </Button>

            <div className="text-center text-xs text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Register Organization
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* Security note */}
      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>Protected by Row Level Security & Supabase SSR</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="w-full max-w-md mx-auto px-4">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
