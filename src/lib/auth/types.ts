export const APP_TAB_IDS = [
  "dashboard",
  "utilization",
  "fuel-thefts",
  "driver-incidents",
  "reports",
] as const;

export type AppTabId = (typeof APP_TAB_IDS)[number];

export const USER_MANAGEMENT_TAB = "users" as const;

export type NavTabId = AppTabId | typeof USER_MANAGEMENT_TAB;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  operator: "Operator",
  viewer: "Viewer",
};

/** Labels shown in the create-account role dropdown */
export const CREATE_ROLE_OPTIONS: {
  value: "admin" | "operator" | "viewer";
  label: string;
}[] = [
  { value: "viewer", label: "User — dashboard access" },
  { value: "operator", label: "Operator — fleet operations" },
  { value: "admin", label: "Admin — all dashboard tabs" },
];

export const TAB_LABELS: Record<NavTabId, string> = {
  dashboard: "Dashboard",
  utilization: "Utilization",
  "fuel-thefts": "Fuel Thefts",
  "driver-incidents": "Driver Incidents",
  reports: "Reports",
  users: "User Management",
};
