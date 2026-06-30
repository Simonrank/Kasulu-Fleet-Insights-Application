"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  Fuel,
  LayoutDashboard,
  LogOut,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { NavTabId } from "@/lib/auth/types";

const OPS_AREA = process.env.NEXT_PUBLIC_OPS_AREA;

export type NavView = NavTabId;

const NAV_ITEMS: {
  id: NavView;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "utilization", label: "Utilization", icon: TrendingUp },
  { id: "fuel-thefts", label: "Fuel Thefts", icon: Fuel },
  { id: "driver-incidents", label: "Driver Incidents", icon: Users },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "users", label: "User management", icon: Shield },
];

type Props = {
  active: NavView;
  allowedViews: NavView[];
  onNavigate: (view: NavView) => void;
  onExpandChange?: (expanded: boolean) => void;
  onPrefetch?: (view: NavView) => void;
};

export function Sidebar({
  active,
  allowedViews,
  onNavigate,
  onExpandChange,
  onPrefetch,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded, onExpandChange]);

  const visibleItems = NAV_ITEMS.filter((item) =>
    allowedViews.includes(item.id)
  );

  return (
    <aside
      className={cn("sidebar", expanded && "sidebar--expanded")}
    >
      <div className="sidebar__inner">
        <div className="sidebar__header">
          <span className="sidebar__heading">Navigation</span>
          <button
            type="button"
            className="sidebar__toggle"
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={expanded}
            aria-pressed={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
            )}
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          {visibleItems.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;

            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-current={isActive ? "page" : undefined}
                onMouseEnter={() => onPrefetch?.(id)}
                onFocus={() => onPrefetch?.(id)}
                onClick={() => onNavigate(id)}
                className={cn(
                  "sidebar__nav-btn",
                  isActive && "sidebar__nav-btn--active"
                )}
              >
                <span className="sidebar__nav-icon">
                  <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
                </span>
                <span className="sidebar__label">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar__info">
          {session?.user?.email && (
            <p className="sidebar__info-text mb-2 truncate">
              {session.user.name ?? session.user.email}
            </p>
          )}
          <button
            type="button"
            className="sidebar__nav-btn w-full"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            <span className="sidebar__nav-icon">
              <LogOut className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
            </span>
            <span className="sidebar__label">Sign out</span>
          </button>
          <p className="sidebar__info-text mt-3">
            {OPS_AREA ??
              "Fleet data syncs with your analysis window on each view."}
          </p>
        </div>
      </div>
    </aside>
  );
}
