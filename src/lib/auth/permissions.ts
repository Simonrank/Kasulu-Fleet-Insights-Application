import {
  APP_TAB_IDS,
  USER_MANAGEMENT_TAB,
  type NavTabId,
  type SessionUser,
} from "@/lib/auth/types";

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}

/** Only the super admin can manage users and see User Management. */
export function canManageUsers(role: string): boolean {
  return isSuperAdmin(role);
}

export function canAccessTab(
  role: string,
  _permissions: string[],
  tab: NavTabId
): boolean {
  if (tab === USER_MANAGEMENT_TAB) {
    return isSuperAdmin(role);
  }
  return APP_TAB_IDS.includes(tab as (typeof APP_TAB_IDS)[number]);
}

/** Fleet tabs for every signed-in user; User Management for super admin only. */
export function accessibleTabs(user: SessionUser): NavTabId[] {
  const tabs: NavTabId[] = [...APP_TAB_IDS];
  if (isSuperAdmin(user.role)) {
    tabs.push(USER_MANAGEMENT_TAB);
  }
  return tabs;
}

/** Permissions stored on new accounts — fleet tabs only; never user management. */
export function defaultPermissionsForRole(role: string): string[] {
  if (role === "super_admin") {
    return [...APP_TAB_IDS, USER_MANAGEMENT_TAB];
  }
  return [...APP_TAB_IDS];
}
