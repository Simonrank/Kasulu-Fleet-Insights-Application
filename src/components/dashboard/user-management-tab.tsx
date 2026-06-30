"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  APP_TAB_IDS,
  ROLE_LABELS,
  TAB_LABELS,
  type AppTabId,
} from "@/lib/auth/types";
import { defaultPermissionsForRole } from "@/lib/auth/permissions";
import type { PublicAppUser } from "@/lib/auth/users";
import type { UserRole } from "@/lib/db/schema";

const ROLE_OPTIONS: UserRole[] = [
  "admin",
  "operator",
  "viewer",
];

type CreateForm = {
  email: string;
  name: string;
  password: string;
  role: UserRole;
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

  function handleRoleChange(role: UserRole) {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-dash-foreground">
          User management
        </h2>
        <p className="mt-1 text-sm text-dash-muted">
          Create accounts and grant access to dashboard tabs.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="dash-panel">
        <h3 className="text-base font-semibold text-dash-foreground">Create account</h3>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Full name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="dash-date-input h-9 w-full rounded-lg px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="dash-date-input h-9 w-full rounded-lg px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Temporary password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="dash-date-input h-9 w-full rounded-lg px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              className="dash-date-input h-9 w-full rounded-lg px-3 text-sm"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                        ? "rounded-full bg-[#0d9488] px-3 py-1 text-xs font-medium text-white"
                        : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                    }
                  >
                    {TAB_LABELS[tab]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="lg:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </div>

      <div className="dash-panel overflow-x-auto">
        <h3 className="text-base font-semibold text-dash-foreground">
          Existing users
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-dash-muted">Loading users…</p>
        ) : sortedUsers.length === 0 ? (
          <p className="mt-4 text-sm text-dash-muted">No users yet.</p>
        ) : (
          <table className="mt-4 w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Access</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="py-3 pr-4">{ROLE_LABELS[user.role]}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {(user.role === "super_admin"
                        ? APP_TAB_IDS
                        : user.permissions
                      ).map((tab) => (
                        <span
                          key={`${user.id}-${tab}`}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                        >
                          {TAB_LABELS[tab as AppTabId] ?? tab}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {user.isActive ? "Active" : "Disabled"}
                  </td>
                  <td className="py-3">
                    {user.role === "super_admin" ? (
                      <span className="text-xs text-slate-400">Protected</span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleUserActive(user)}
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
