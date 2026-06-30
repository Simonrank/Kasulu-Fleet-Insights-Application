"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TheftFilter } from "@/lib/types";

type TheftFilterContextValue = {
  theftType: TheftFilter;
  setTheftType: (value: TheftFilter) => void;
};

const TheftFilterContext = createContext<TheftFilterContextValue | null>(null);

export function TheftFilterProvider({ children }: { children: ReactNode }) {
  const [theftType, setTheftType] = useState<TheftFilter>("all");

  const value = useMemo(
    () => ({ theftType, setTheftType }),
    [theftType]
  );

  return (
    <TheftFilterContext.Provider value={value}>
      {children}
    </TheftFilterContext.Provider>
  );
}

export function useTheftFilter(): TheftFilterContextValue {
  const ctx = useContext(TheftFilterContext);
  if (!ctx) {
    throw new Error("useTheftFilter must be used within TheftFilterProvider");
  }
  return ctx;
}
