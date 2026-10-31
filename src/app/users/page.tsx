"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  getUsersListAction,
  createStaffMemberAction,
  toggleStaffActiveStatusAction,
} from "@/modules/users/actions";
import { UserListItem, UserStats } from "@/modules/users/types";
import { UserRole } from "@/modules/auth/types";
import { formatDate } from "@/lib/utils";
import {
  UserPlus,
  Search,
  ShieldCheck,
  Users,
  UserCheck,
  Building,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
} from "lucide-react";

const AVAILABLE_PERMISSIONS = [
  { id: "customers:manage", label: "Manage Customers" },
  { id: "subscriptions:manage", label: "Manage Subscriptions" },
  { id: "invoices:manage", label: "Manage Invoices" },
  { id: "payments:manage", label: "Process Payments" },
  { id: "catalog:view", label: "View Product Catalog" },
  { id: "quotations:manage", label: "Manage Quotations" },
];

export default function UserManagementPage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [users, setUsers] = React.useState<UserListItem[]>([]);
  const [stats, setStats] = React.useState<UserStats>({
    totalUsers: 0,
    adminsCount: 0,
    staffCount: 0,
    customersCount: 0,
  });
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters & Pagination
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 8;

  // Modals state
  const [createStaffOpen, setCreateStaffOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<UserListItem | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  // Create Staff Form
  const [staffEmail, setStaffEmail] = React.useState("");
  const [staffName, setStaffName] = React.useState("");
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([
    "customers:manage",
    "subscriptions:manage",
    "invoices:manage",
  ]);
  const [isSubmittingStaff, setIsSubmittingStaff] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const fetchUsers = React.useCallback(() => {
    setIsLoading(true);
    setRefreshKey((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const result = await getUsersListAction({
          search: search.trim() || undefined,
          role: roleFilter,
          status: statusFilter,
          page: currentPage,
          pageSize,
        });

        if (isMounted) {
          if (result.error) {
            toastError(result.error);
          } else {
            setUsers(result.users);
            setTotalCount(result.totalCount);
            setStats(result.stats);
          }
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          toastError("Failed to fetch user directory.");
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [search, roleFilter, statusFilter, currentPage, pageSize, refreshKey, toastError]);

  const handleToggleActive = async (user: UserListItem) => {
    const newStatus = !user.is_active;
    try {
      const result = await toggleStaffActiveStatusAction({
        userId: user.id,
        isActive: newStatus,
      });

      if (result.error) {
        toastError(result.error);
      } else {
        toastSuccess(
          `User ${user.email} is now ${newStatus ? "active" : "deactivated"}.`
        );
        fetchUsers();
      }
    } catch {
      toastError("Failed to update status.");
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingStaff(true);

    try {
      const result = await createStaffMemberAction({
        email: staffEmail,
        fullName: staffName,
        permissions: selectedPermissions,
      });

      if (result.error) {
        toastError(result.error);
      } else {
        toastSuccess(result.message || "Staff account created successfully.");
        setCreateStaffOpen(false);
        setStaffEmail("");
        setStaffName("");
        setSelectedPermissions(["customers:manage", "subscriptions:manage"]);
        fetchUsers();
      }
    } catch {
      toastError("Failed to provision staff member.");
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Page Title & Action Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Staff & User Directory
            </h1>
            <Badge variant="default" className="text-xs">
              Admin Governance
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage organization members, assign operational staff permissions, and review customer accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchUsers()} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>

          {/* Create Staff Modal */}
          <Dialog open={createStaffOpen} onOpenChange={setCreateStaffOpen}>
            <DialogTrigger asChild>
              <Button size="sm" leftIcon={<UserPlus className="h-4 w-4" />}>
                Invite Staff Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Provision Staff Account</DialogTitle>
                <DialogDescription>
                  Create an operational staff account with explicit permissions. Staff cannot elevate roles or configure pricing.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateStaff} className="space-y-4">
                <Input
                  id="staff-name"
                  label="Full Name"
                  placeholder="Alex Mercer"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  disabled={isSubmittingStaff}
                />

                <Input
                  id="staff-email"
                  type="email"
                  label="Staff Business Email"
                  placeholder="alex.mercer@brightloop.io"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  disabled={isSubmittingStaff}
                />

                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Assign Allowed Permissions
                  </label>
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/50">
                    {AVAILABLE_PERMISSIONS.map((perm) => {
                      const isChecked = selectedPermissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPermissions((prev) => [...prev, perm.id]);
                              } else {
                                setSelectedPermissions((prev) => prev.filter((id) => id !== perm.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateStaffOpen(false)}
                    disabled={isSubmittingStaff}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" isLoading={isSubmittingStaff}>
                    Authorize & Create Staff
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Users</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            {stats.totalUsers}
          </p>
          <span className="text-[10px] text-slate-400">All registered profiles</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Staff Members</span>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            {stats.staffCount}
          </p>
          <span className="text-[10px] text-blue-600 font-medium">Operational Scope</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Administrators</span>
            <ShieldCheck className="h-4 w-4 text-slate-900" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            {stats.adminsCount}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">Full Governance</span>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Customers</span>
            <Building className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            {stats.customersCount}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Organizations</span>
        </Card>
      </div>

      {/* Directory Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full max-w-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="search"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(["all", "staff", "admin", "customer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRoleFilter(r);
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    roleFilter === r
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {r === "all" ? "All Users" : r}
                </button>
              ))}

              <div className="h-4 w-px bg-slate-200 mx-1" />

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "active" | "inactive");
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">Status: All</option>
                <option value="active">Active Only</option>
                <option value="inactive">Deactivated Only</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-72">User Identity</TableHead>
                <TableHead className="w-32">Role</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Organization / Scope</TableHead>
                <TableHead className="w-36">Created</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableEmpty message="No users match the specified criteria." />
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 text-xs">
                          {u.full_name || "—"}
                        </span>
                        <span className="text-[11px] text-slate-500">{u.email}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          u.role === "admin"
                            ? "default"
                            : u.role === "staff"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize"
                      >
                        {u.role}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Deactivated
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {u.role === "customer" ? (
                        <div className="flex items-center gap-1 text-xs text-slate-700">
                          <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{u.customer_company_name || "Customer Account"}</span>
                        </div>
                      ) : u.role === "staff" ? (
                        <div className="flex flex-wrap gap-1">
                          {u.permissions && u.permissions.length > 0 ? (
                            u.permissions.slice(0, 2).map((p) => (
                              <span
                                key={p}
                                className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200"
                              >
                                {p.split(":")[0]}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">Standard Staff</span>
                          )}
                          {u.permissions && u.permissions.length > 2 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{u.permissions.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono text-[11px]">
                          System Administrator
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-slate-500">
                      {formatDate(u.created_at)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setSelectedUser(u);
                            setDetailsOpen(true);
                          }}
                          aria-label="View user profile"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                        </Button>

                        {/* Can only toggle active status on non-admin users */}
                        {u.role !== "admin" && (
                          <Button
                            variant={u.is_active ? "ghost" : "outline"}
                            size="sm"
                            className={`h-7 px-2 text-[10px] ${
                              u.is_active ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            onClick={() => handleToggleActive(u)}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            className="border-t border-slate-100 mt-2"
          />
        </CardContent>
      </Card>

      {/* User Details Drawer Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Profile & Security Details</DialogTitle>
            <DialogDescription>
              Inspection of user metadata, assigned permissions, and system role.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 text-xs">
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-semibold text-slate-900 text-sm">
                    {selectedUser.full_name || "No name recorded"}
                  </span>
                  <Badge variant={selectedUser.role === "admin" ? "default" : "secondary"}>
                    {selectedUser.role}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Email Address
                    </span>
                    <span className="font-medium text-slate-800">{selectedUser.email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Account Status
                    </span>
                    <span className={selectedUser.is_active ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}>
                      {selectedUser.is_active ? "Active" : "Deactivated"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      User Identifier (UUID)
                    </span>
                    <span className="font-mono text-[11px] text-slate-700 truncate block">
                      {selectedUser.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Registration Date
                    </span>
                    <span className="text-slate-800">{formatDate(selectedUser.created_at)}</span>
                  </div>
                </div>

                {selectedUser.customer_company_name && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Linked Customer Organization
                    </span>
                    <span className="font-semibold text-slate-900">
                      {selectedUser.customer_company_name}
                    </span>
                  </div>
                )}

                {selectedUser.role === "staff" && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Assigned Operational Permissions
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUser.permissions && selectedUser.permissions.length > 0 ? (
                        selectedUser.permissions.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px]">
                            {p}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-400">Standard Staff Access</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
