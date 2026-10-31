"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { registerAction } from "@/modules/auth/actions";
import { Zap, ShieldCheck, Check, X, ArrowRight, Building, User } from "lucide-react";

export default function RegisterPage() {
  const { error: toastError, success: toastSuccess } = useToast();

  const [fullName, setFullName] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [registeredSuccess, setRegisteredSuccess] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");

  // Live password policy checks
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
      toastError("Please meet all password security policy requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: ["Passwords do not match"] });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerAction({
        fullName,
        companyName,
        email,
        password,
        confirmPassword,
      });

      if (result.error) {
        toastError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        toastSuccess(result.message || "Registration completed successfully!", "Account Created");
        setStatusMessage(result.message || "Your account has been registered.");
        setRegisteredSuccess(true);
      }
    } catch {
      toastError("Failed to register account. Please check your network and retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registeredSuccess) {
    return (
      <div className="w-full max-w-md mx-auto px-4 text-center">
        <Card className="border-slate-200 shadow-sm bg-white p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
            <Check className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Registration Successful</CardTitle>
          <CardDescription className="mt-2 text-slate-600">
            {statusMessage}
          </CardDescription>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link href="/login">
              <Button className="w-full">Proceed to Sign In</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-4">
      {/* Brand Heading */}
      <div className="text-center mb-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md mb-3">
          <Zap className="h-6 w-6 fill-current" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Register Customer Account
          </h1>
          <Badge variant="secondary">Customer Portal</Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Create an enterprise organization profile on the Brightloop billing platform.
        </p>
      </div>

      {/* Registration Card */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg">Organization Details</CardTitle>
          <CardDescription>
            All registered organizations start with verified Customer standing.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="reg-fullname"
                label="Full Name"
                placeholder="Jane Doe"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={fieldErrors.fullName?.[0]}
                disabled={isSubmitting}
                leftAddon={<User className="h-4 w-4" />}
              />
              <Input
                id="reg-company"
                label="Company Name"
                placeholder="Acme Global Inc"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                error={fieldErrors.companyName?.[0]}
                disabled={isSubmitting}
                leftAddon={<Building className="h-4 w-4" />}
              />
            </div>

            <Input
              id="reg-email"
              type="email"
              label="Business Email"
              placeholder="billing@acmeglobal.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email?.[0]}
              disabled={isSubmitting}
            />

            <Input
              id="reg-password"
              type="password"
              label="Password"
              placeholder="••••••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password?.[0]}
              disabled={isSubmitting}
            />

            {/* Password Policy Live Requirements Checklist */}
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1.5">
              <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                Password Security Policy:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600">
                <div className="flex items-center gap-1.5">
                  {checks.length ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className={checks.length ? "text-slate-900 font-medium" : ""}>
                    More than 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.hasUpper ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className={checks.hasUpper ? "text-slate-900 font-medium" : ""}>
                    One uppercase letter (A-Z)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.hasLower ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className={checks.hasLower ? "text-slate-900 font-medium" : ""}>
                    One lowercase letter (a-z)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.hasSpecial ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className={checks.hasSpecial ? "text-slate-900 font-medium" : ""}>
                    One special symbol (!@#$...)
                  </span>
                </div>
              </div>
            </div>

            <Input
              id="reg-confirm-password"
              type="password"
              label="Confirm Password"
              placeholder="••••••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirmPassword?.[0]}
              disabled={isSubmitting}
            />
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Complete Registration
            </Button>

            <div className="text-center text-xs text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Sign In
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* Security note */}
      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>Staff & Admin roles can only be granted by existing Administrators</span>
      </div>
    </div>
  );
}
