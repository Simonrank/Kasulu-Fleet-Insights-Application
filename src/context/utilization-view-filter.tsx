"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UtilizationViewFilter = "all" | "top" | "underutilized";

type UtilizationViewFilterContextValue = {
  view: UtilizationViewFilter;
  setView: (value: UtilizationViewFilter) => void;
};

const UtilizationViewFilterContext =
  createContext<UtilizationViewFilterContextValue | null>(null);

export function UtilizationViewFilterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [view, setView] = useState<UtilizationViewFilter>("all");

  const value = useMemo(() => ({ view, setView }), [view]);

  return (
    <UtilizationViewFilterContext.Provider value={value}>
      {children}
    </UtilizationViewFilterContext.Provider>
  );
}

export function useUtilizationViewFilter(): UtilizationViewFilterContextValue {
  const ctx = useContext(UtilizationViewFilterContext);
  if (!ctx) {
    throw new Error(
      "useUtilizationViewFilter must be used within UtilizationViewFilterProvider"
    );
  }
  return ctx;
}
