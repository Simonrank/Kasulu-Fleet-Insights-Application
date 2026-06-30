import {
  APP_TAB_IDS,
  USER_MANAGEMENT_TAB,
  type NavTabId,
  type SessionUser,
} from "@/lib/auth/types";

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
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
  if (isSuperAdmin(user.role)) {
    return [...APP_TAB_IDS, USER_MANAGEMENT_TAB];
  }

  return APP_TAB_IDS.filter((tab) => user.permissions.includes(tab));
}

export function defaultPermissionsForRole(role: string): string[] {
  switch (role) {
    case "super_admin":
    case "admin":
      return [...APP_TAB_IDS];
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
