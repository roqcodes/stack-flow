# Brightloop Architecture, Routes & Permission Guide

This document specifies the routing structure, shared layout components, and permission architecture of the Brightloop Subscription Management and Recurring Billing Monolith.

---

## 1. Route Hierarchy & Access Matrix

| Route | Purpose | Access Level | Enforcement Layer |
|---|---|---|---|
| `/login` | Public user authentication | Public (Redirects to `/` if logged in) | Middleware + Client |
| `/register` | Customer organization registration | Public (Strictly provisions `customer` role) | Middleware + PostgreSQL Trigger |
| `/forgot-password` | Password reset dispatch | Public | Middleware |
| `/reset-password` | Secure password update | Authenticated Recovery Session | Middleware |
| `/unauthorized` | Access-denied error view | Authenticated (Insufficient role) | Client / Auth Utils |
| `/` or `/dashboard` | Platform metrics & overview | Authenticated (All roles) | Middleware + `requireAuth()` |
| `/users` | Staff & User Directory | **Admin Only** | Middleware + `requireRole(['admin'])` |
| `/customers` | Customer accounts & organizations | Admin, Staff | Middleware + RLS |
| `/subscriptions` | Subscriptions & lifecycle | Admin, Staff, Customer (Self) | Middleware + RLS |
| `/invoices` | Invoices & statements | Admin, Staff, Customer (Self) | Middleware + RLS |
| `/payments` | Payments & multi-invoice allocations | Admin, Staff, Customer (Self) | Middleware + RLS |
| `/quotations` | Sales quotes & conversion pipeline | Admin, Staff, Customer (Self) | Middleware + RLS |
| `/products` | Products, plans, & plan rules | Admin (Write), Staff (Read) | Middleware + RLS |
| `/discounts` | Coupons & promotions | Admin (Write), Staff (Read) | Middleware + RLS |
| `/taxes` | Regional tax jurisdictions | Admin (Write), Staff (Read) | Middleware + RLS |
| `/billing` | Recurring billing cron & engine logs | **Admin Only** | Middleware + RLS |
| `/analytics` | Financial MRR/ARR analytics | Admin, Staff | Middleware + RLS |
| `/audit` | Immutable audit log trail | **Admin Only** | Middleware + RLS |
| `/settings` | Organization & profile settings | Authenticated (All roles) | Middleware + RLS |

---

## 2. Shared Layout Architecture

### `DashboardShell` (`src/components/layout/dashboard-shell.tsx`)
* Wraps the application in `ToastProvider` and `AuthProvider`.
* Detects authentication paths (`/login`, `/register`, etc.) and automatically switches between:
  1. **Centered Standalone View:** Clean, distraction-free container for authentication workflows.
  2. **Enterprise Dashboard Layout:** Responsive collapsible sidebar, sticky header with breadcrumbs and live environment indicators, and max-w-7xl content container.

### `Sidebar` (`src/components/layout/sidebar.tsx`)
* Categorizes routes into four logical sections: *Core Operations*, *Billing & Revenue*, *Product Catalog*, and *Administration*.
* **Dynamic Role Filtering:** Automatically suppresses unauthorized navigation items according to the user's role (`admin`, `staff`, or `customer`).

### `Header` (`src/components/layout/header.tsx`)
* Renders real-time `<Breadcrumbs />` derived from the active URL path.
* Displays current user avatar initials, full name, business email, and role badge.
* Integrated notification popover showing active database and system health.
* User dropdown with secure server-side Sign Out action.

---

## 3. Reusable Atomic UI Foundations

All components reside in `src/components/ui/` and adhere strictly to TypeScript strict mode:

1. **Button:** Primary, secondary, outline, ghost, destructive, and link variants with loading spinners and icon slots.
2. **Input & Textarea:** Styled form inputs with labels, helper text, error messages, and adornments.
3. **Select:** Accessible native select with custom chevron dropdown indicator.
4. **Dialog:** Accessible modal with keyboard escape handling, scroll locking, and backdrop dismissal.
5. **Dropdown:** Context-driven menu with click-outside listener.
6. **Table:** Enterprise data table family (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableEmpty`).
7. **Badge:** Domain status badges (`default`, `secondary`, `success`, `warning`, `destructive`, `outline`).
8. **Card:** Compositional card container (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
9. **Skeleton:** Pulsing placeholder for loading states.
10. **Toast:** Context-driven notification hook (`useToast()`) with auto-dismiss timers.
11. **Pagination:** Accessible multi-page navigation controls with item range counters.

---

## 4. Reusable Permission System

Instead of scattering hardcoded `if (role === 'admin')` statements throughout the UI, Brightloop uses a centralized permission matrix:

### Permission Constants (`src/modules/auth/permissions.ts`)
```typescript
import { PERMISSIONS, hasPermission } from "@/modules/auth/permissions";

// Check permission programmatically
const canManage = hasPermission(user.role, PERMISSIONS.USERS_MANAGE);
```

### Declarative UI Gate (`<Can />`)
```tsx
import { Can } from "@/components/auth/can";
import { PERMISSIONS } from "@/modules/auth/permissions";

<Can permission={PERMISSIONS.STAFF_CREATE}>
  <Button onClick={openCreateModal}>Invite Staff Member</Button>
</Can>
```

### Server Action Enforcement
```typescript
import { requireRole } from "@/modules/auth/auth-utils";

export async function createStaffAction(...) {
  await requireRole(["admin"]); // Rejects unauthorized calls server-side
  // ...
}
```

---

## 5. Security Invariants

1. **No Client Role Selection:** Public registration triggers the `handle_new_user()` PostgreSQL function which hardcodes `'customer'` role.
2. **Admin-Only Staff Provisioning:** Staff accounts can only be created by an active administrator.
3. **Audit Logging:** Every administrative user management change (staff creation, activation/deactivation, permission modification) is logged to `public.audit_logs`.
