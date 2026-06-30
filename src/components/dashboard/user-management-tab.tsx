"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, UserPlus } from "lucide-react";
import {
  APP_TAB_IDS,
  CREATE_ROLE_OPTIONS,
  ROLE_LABELS,
  TAB_LABELS,
  type AppTabId,
} from "@/lib/auth/types";
import { defaultPermissionsForRole } from "@/lib/auth/permissions";
import type { PublicAppUser } from "@/lib/auth/users";
import type { UserRole } from "@/lib/db/schema";

type CreateRole = (typeof CREATE_ROLE_OPTIONS)[number]["value"];

type CreateForm = {
  email: string;
  name: string;
  password: string;
  role: CreateRole;
  permissions: AppTabId[];
};

const EMPTY_FORM: CreateForm = {
  email: "",
  name: "",
  password: "",
  role: "viewer",
  permissions: defaultPermissionsForRole("viewer") as AppTabId[],
};

export function UserManagementTab() {
  const [users, setUsers] = useState<PublicAppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showAccess, setShowAccess] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/users");
      const payload = (await response.json()) as {
        users?: PublicAppUser[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load users");
      }
      setUsers(payload.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        a.email.localeCompare(b.email, undefined, { sensitivity: "base" })
      ),
    [users]
  );

  function togglePermission(tab: AppTabId) {
    setForm((current) => {
      const permissions = current.permissions.includes(tab)
        ? current.permissions.filter((item) => item !== tab)
        : [...current.permissions, tab];
      return { ...current, permissions };
    });
  }

  function handleRoleChange(role: CreateRole) {
    setForm((current) => ({
      ...current,
      role,
      permissions: defaultPermissionsForRole(role) as AppTabId[],
    }));
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as {
        user?: PublicAppUser;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create user");
      }
      setForm(EMPTY_FORM);
      setShowAccess(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserActive(user: PublicAppUser) {
    setError(null);
    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          isActive: !user.isActive,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update user");
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-2">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <UserPlus className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Create account
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              New users sign in with email and password on the login page.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="dash-date-input h-11 w-full rounded-xl px-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Full name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="dash-date-input h-11 w-full rounded-xl px-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="dash-date-input h-11 w-full rounded-xl px-3 text-sm"
            />
            <p className="text-xs text-slate-400">Minimum 8 characters</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Role
            </label>
            <div className="relative">
              <select
                value={form.role}
                onChange={(e) =>
                  handleRoleChange(e.target.value as CreateRole)
                }
                className="dash-date-input h-11 w-full appearance-none rounded-xl px-3 pr-10 text-sm"
              >
                {CREATE_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAccess((value) => !value)}
            className="text-xs font-medium text-teal-700 hover:text-teal-800"
          >
            {showAccess ? "Hide custom tab access" : "Customize tab access"}
          </button>

          {showAccess && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tab access
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {APP_TAB_IDS.map((tab) => {
                  const active = form.permissions.includes(tab);
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => togglePermission(tab)}
                      className={
                        active
                          ? "rounded-full bg-teal-600 px-3 py-1 text-xs font-medium text-white"
                          : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                      }
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 text-sm font-semibold text-slate-900 transition-colors hover:bg-emerald-400 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" strokeWidth={2.25} />
            {saving ? "Creating…" : "Create account"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Existing users
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading users…</p>
        ) : sortedUsers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No users yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {sortedUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {ROLE_LABELS[user.role]}
                    {!user.isActive && " · Disabled"}
                  </p>
                </div>
                {user.role !== "super_admin" && (
                  <button
                    type="button"
                    onClick={() => void toggleUserActive(user)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {user.isActive ? "Disable" : "Enable"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
