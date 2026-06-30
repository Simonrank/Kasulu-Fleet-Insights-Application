import {
  APP_TAB_IDS,
  USER_MANAGEMENT_TAB,
  type NavTabId,
  type SessionUser,
} from "@/lib/auth/types";

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}

export function canManageUsers(role: string): boolean {
  return role === "super_admin" || role === "admin";
}

export function canAccessTab(
  role: string,
  permissions: string[],
  tab: NavTabId
): boolean {
  if (isSuperAdmin(role)) return true;
  if (tab === USER_MANAGEMENT_TAB) return false;
  return permissions.includes(tab);
}

export function accessibleTabs(user: SessionUser): NavTabId[] {
  const tabs = new Set<NavTabId>();

  if (isSuperAdmin(user.role) || user.role === "admin") {
    for (const tab of APP_TAB_IDS) tabs.add(tab);
  } else {
    for (const tab of APP_TAB_IDS) {
      if (user.permissions.includes(tab)) tabs.add(tab);
    }
  }

  if (
    canManageUsers(user.role) ||
    user.permissions.includes(USER_MANAGEMENT_TAB)
  ) {
    tabs.add(USER_MANAGEMENT_TAB);
  }

  return [...tabs];
}

export function defaultPermissionsForRole(role: string): string[] {
  switch (role) {
    case "super_admin":
      return [...APP_TAB_IDS, USER_MANAGEMENT_TAB];
    case "admin":
      return [...APP_TAB_IDS, USER_MANAGEMENT_TAB];
    case "operator":
      return [
        "dashboard",
        "utilization",
        "fuel-thefts",
        "driver-incidents",
      ];
    case "viewer":
    default:
      return ["dashboard", "reports"];
  }
}
