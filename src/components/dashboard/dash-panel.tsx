"use client";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
};

export function DashPanel({ title, subtitle, children, className }: Props) {
  return (
    <div className={cn("dash-panel h-full", className)}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-dash-foreground">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-xs text-dash-muted">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
