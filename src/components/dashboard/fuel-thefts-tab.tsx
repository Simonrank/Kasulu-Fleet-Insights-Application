"use client";

import { useMemo } from "react";
import { useFuelThefts } from "@/hooks/use-fleet-data";
import { useFleetCategoryFilter } from "@/context/fleet-category-filter";
import { useTheftFilter } from "@/context/theft-filter";
import {
  DataLoadError,
  VERCEL_SHEETS_HINTS,
} from "@/components/dashboard/data-load-error";
import {
  buildFuelSummaryFooter,
  filterFuelFleetRows,
  FleetFuelTheftSummaryTable,
} from "@/components/dashboard/fleet-fuel-theft-summary-table";

type Props = {
  from: string;
  to: string;
};

function FuelTheftsSkeleton() {
  return (
    <div className="p-6 md:p-8">
      <div className="h-[28rem] animate-pulse rounded-2xl bg-white shadow-sm" />
    </div>
  );
}

export function FuelTheftsTab({ from, to }: Props) {
  const { theftType: type } = useTheftFilter();
  const {
    categoryFilter,
    isActive: categoryFilterActive,
    unitCategoryById,
  } = useFleetCategoryFilter();
  const { data, isLoading, isError, error, refetch, isFetching } =
    useFuelThefts(from, to, type);

  const filteredTable = useMemo(() => {
    if (!data) return [];
    return filterFuelFleetRows(data.fleetTable, {
      theftType: type,
      categoryFilter,
      unitCategoryById,
    });
  }, [data, type, categoryFilter, unitCategoryById]);

  const footerTotals = useMemo(() => {
    if (!data) return null;
    const hasFilters = type !== "all" || categoryFilterActive;
    return buildFuelSummaryFooter(data, filteredTable, hasFilters);
  }, [data, filteredTable, type, categoryFilterActive]);

  if ((isLoading && !data) || (isFetching && !data)) {
    return <FuelTheftsSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[40vh] items-start justify-center p-6 md:p-8">
        <DataLoadError
          title="Fuel thefts could not load"
          message={
            error instanceof Error
              ? error.message
              : "Sheet data did not load for this period."
          }
          hints={VERCEL_SHEETS_HINTS}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  const hasActiveFilters = type !== "all" || categoryFilterActive;

  return (
    <div className="dashboard-workspace relative min-h-full">
      <div className="dashboard-workspace__glow pointer-events-none" aria-hidden />

      <div className="relative space-y-4 p-6 md:p-8">
        {hasActiveFilters && (
          <p className="rounded-lg border border-[#99f6e4]/40 bg-[#f0fdfa]/60 px-3 py-2 text-sm text-[#0f766e]">
            Showing {filteredTable.length} of {data.fleetTable.length} units
            {type !== "all"
              ? type === "direct"
                ? " · direct thefts only"
                : " · return pipe only"
              : ""}
            {categoryFilterActive ? ` · ${categoryFilter}` : ""}
          </p>
        )}

        <FleetFuelTheftSummaryTable
          rows={filteredTable}
          footerTotals={footerTotals}
        />
      </div>
    </div>
  );
}
