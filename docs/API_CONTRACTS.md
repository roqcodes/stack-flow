# Brightloop API & Server Action Contracts

This document defines the strict communication and response standards required across all business modules in Brightloop.

---

## 1. Unified Response Contract

All Server Actions and Route Handlers must return responses conforming to the `ApiResponse<T>` contract defined in [src/lib/api-response.ts](file:///c:/Users/LOQ/OneDrive/Desktop/StackFlow/src/lib/api-response.ts):

### Success Response
```typescript
{
  success: true,
  data: T
}
```

### Failure Response
```typescript
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: unknown
  }
}
```

---

## 2. Standard Error Codes (`ERROR_CODES`)

* `UNAUTHENTICATED`: User session missing or expired.
* `FORBIDDEN`: User role or permissions insufficient for operation.
* `VALIDATION_ERROR`: Zod payload validation failed (details contain field error map).
* `NOT_FOUND`: Referenced database record does not exist.
* `CONFLICT`: Uniqueness constraint violation (e.g., duplicate email, code, or sku).
* `DUPLICATE_BILLING_CYCLE`: Invoice already generated for subscription and billing period.
* `DATABASE_ERROR`: PostgreSQL constraint failure or database timeout.
* `INTERNAL_SERVER_ERROR`: Unhandled exception.

---

## 3. Server Action Implementation Standard

Every Server Action must follow this four-phase lifecycle:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/modules/auth/auth-utils";
import { apiSuccess, apiError, ApiResponse, ERROR_CODES } from "@/lib/api-response";
import { createEntitySchema, CreateEntityInput } from "./validations";

export async function createEntityAction(
  input: CreateEntityInput
): Promise<ApiResponse<EntityResult>> {
  try {
    // Phase 1: Authentication & RBAC Verification
    const { user, profile } = await requireRole(["admin", "staff"]);

    // Phase 2: Schema Validation
    const validation = createEntitySchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    // Phase 3: Server-Authoritative Database Execution
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("entities")
      .insert({
        ...validation.data,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      return apiError(ERROR_CODES.DATABASE_ERROR, error.message);
    }

    // Phase 4: Structured Return
    return apiSuccess(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
```

---

## 4. Client Invocation Standard

Client components consuming Server Actions must handle both branches cleanly:

```tsx
const result = await createEntityAction(formData);

if (!result.success) {
  toast.error(result.error.message);
  if (result.error.details) {
    setFieldErrors(result.error.details as Record<string, string[]>);
  }
  return;
}

toast.success("Record created successfully!");
router.refresh();
```

---

## 5. Supabase Client Invocations

| Context | Client Creator | Path | Notes |
|---|---|---|---|
| Client Component | `createClient()` | `@/lib/supabase/client` | Anon key, reads browser cookies |
| Server Component / Action | `createClient()` | `@/lib/supabase/server` | Anon key, reads `cookies()` from `next/headers` |
| Middleware | `createServerClient()` | `@/lib/supabase/middleware` | Session refresh, cookie setAll |
| Privileged Worker (Cron / Admin) | `createAdminClient()` | `@/lib/supabase/admin` | **Server-Only**, bypasses RLS, uses Service Key |
