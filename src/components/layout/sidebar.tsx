"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  Fuel,
  LayoutDashboard,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const OPS_AREA = process.env.NEXT_PUBLIC_OPS_AREA;

export type NavView =
  | "dashboard"
  | "utilization"
  | "fuel-thefts"
  | "driver-incidents"
  | "reports";

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
];

type Props = {
  active: NavView;
  onNavigate: (view: NavView) => void;
  onExpandChange?: (expanded: boolean) => void;
  onPrefetch?: (view: NavView) => void;
};

export function Sidebar({ active, onNavigate, onExpandChange, onPrefetch }: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded, onExpandChange]);

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
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
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
          <p className="sidebar__info-text">
            {OPS_AREA ??
              "Fleet data syncs with your analysis window on each view."}
          </p>
        </div>
      </div>
    </aside>
  );
}
