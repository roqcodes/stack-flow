"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ArrowLeft, LogOut, Home } from "lucide-react";
import { logoutAction } from "@/modules/auth/actions";

export default function UnauthorizedPage() {
  return (
    <div className="w-full max-w-md mx-auto px-4 text-center">
      <Card className="border-slate-200 shadow-sm bg-white p-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-4 border border-red-200">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div className="space-y-1 mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Badge variant="destructive">Access Denied</Badge>
          </div>
          <CardTitle className="text-xl text-slate-900">
            Unauthorized Permission Scope
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            You do not possess the role permissions required to access this resource.
          </CardDescription>
        </div>

        <CardContent className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-left space-y-2 mb-6">
          <p className="font-semibold text-slate-800">Why am I seeing this?</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-500">
            <li>This route requires an elevated role (<span className="font-semibold text-slate-700">Administrator</span> or <span className="font-semibold text-slate-700">Staff</span>).</li>
            <li>Customer accounts are restricted exclusively to self-service invoices, quotations, and active subscriptions.</li>
            <li>If you require administrative privileges, an existing system administrator must promote your account.</li>
          </ul>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-0 p-0 border-0">
          <Link href="/" className="w-full">
            <Button variant="primary" className="w-full" leftIcon={<Home className="h-4 w-4" />}>
              Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full text-slate-600"
            onClick={async () => {
              await logoutAction();
            }}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            Switch User
          </Button>
        </CardFooter>
      </Card>

      <div className="mt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Return to previous screen
        </Link>
      </div>
    </div>
  );
}
