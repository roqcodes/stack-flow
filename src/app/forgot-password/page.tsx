"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { forgotPasswordAction } from "@/modules/auth/actions";
import { Zap, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const result = await forgotPasswordAction({ email });

      if (result.error) {
        toastError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        toastSuccess("Password recovery instructions dispatched.", "Reset Email Sent");
        setSubmitted(true);
      }
    } catch {
      toastError("Failed to request password reset. Please try again.");
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
          Reset Your Password
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Brightloop Security & Identity Services
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm bg-white">
        {submitted ? (
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Check Your Email</CardTitle>
            <CardDescription className="text-slate-600 text-xs leading-relaxed">
              We have dispatched a secure password reset link to{" "}
              <span className="font-semibold text-slate-900">{email}</span>. Click the link in that email to choose a new password.
            </CardDescription>
            <div className="pt-4 border-t border-slate-100">
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Forgot Password</CardTitle>
              <CardDescription>
                Enter your registered business email and we&apos;ll send you a secure link to reset your credentials.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                id="forgot-email"
                type="email"
                label="Registered Email"
                placeholder="name@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email?.[0]}
                disabled={isSubmitting}
                leftAddon={<Mail className="h-4 w-4" />}
              />
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Send Reset Link
              </Button>

              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
