"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useDriverIncidents } from "@/hooks/use-fleet-data";
import { TabWorkspace } from "@/components/dashboard/tab-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

type Props = {
  from: string;
  to: string;
};

const INCIDENT_LABELS: Record<string, string> = {
  speed_violation: "Speed Violation",
  harsh_braking: "Harsh Braking",
  harsh_acceleration: "Harsh Acceleration",
  geo_fence_breach: "Geo-fence Breach",
  unauthorized_movement: "Unauthorized Movement",
  idle_exceedance: "Idle Exceedance",
};

const INCIDENT_TYPES = Object.keys(INCIDENT_LABELS);

export function DriverIncidentsTab({ from, to }: Props) {
  const [search, setSearch] = useState("");
  const [incidentType, setIncidentType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const { data, isLoading } = useDriverIncidents(from, to);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();

    return data.filter((row) => {
      if (incidentType !== "all" && row.incidentType !== incidentType) {
        return false;
      }
      if (severity !== "all" && row.severity !== severity) {
        return false;
      }
      if (!query) return true;

      const typeLabel = INCIDENT_LABELS[row.incidentType] ?? row.incidentType;
      return [row.unitName, row.driverName, typeLabel, row.locationName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, search, incidentType, severity]);

  if (isLoading || !data) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const byType = filteredRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.incidentType] = (acc[row.incidentType] ?? 0) + 1;
    return acc;
  }, {});

  const hasActiveFilters =
    search.length > 0 || incidentType !== "all" || severity !== "all";

  return (
    <div className="space-y-6">
      <TabWorkspace
        title="Kasulu driver incidents workspace"
        from={from}
        to={to}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Unit, driver, incident type, or location"
        filters={[
          {
            id: "incident-type",
            label: "Incident type",
            value: incidentType,
            onChange: setIncidentType,
            placeholder: "All incident types",
            options: [
              { value: "all", label: "All incident types" },
              ...INCIDENT_TYPES.map((type) => ({
                value: type,
                label: INCIDENT_LABELS[type] ?? type,
              })),
            ],
          },
          {
            id: "severity",
            label: "Severity",
            value: severity,
            onChange: setSeverity,
            placeholder: "All severities",
            options: [
              { value: "all", label: "All severities" },
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ],
          },
        ]}
        resultSummary={
          hasActiveFilters
            ? `Showing ${filteredRows.length} of ${data.length} incidents`
            : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        {Object.entries(byType).map(([type, count]) => (
          <Badge key={type} variant="outline">
            {INCIDENT_LABELS[type] ?? type}: {count}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Driver Incidents ({filteredRows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Unit</th>
                <th className="pb-2 pr-4 font-medium">Driver</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Value</th>
                <th className="pb-2 pr-4 font-medium">Severity</th>
                <th className="pb-2 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4">
                    {format(new Date(row.occurredAt), "dd MMM HH:mm")}
                  </td>
                  <td className="py-2.5 pr-4 font-medium">{row.unitName}</td>
                  <td className="py-2.5 pr-4">{row.driverName ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    {INCIDENT_LABELS[row.incidentType] ?? row.incidentType}
                  </td>
                  <td className="py-2.5 pr-4">
                    {row.value != null ? formatNumber(row.value, 1) : "—"}
                    {row.threshold != null && (
                      <span className="text-muted-foreground">
                        {" "}/ {formatNumber(row.threshold, 1)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge
                      variant={
                        row.severity === "high" || row.severity === "critical"
                          ? "destructive"
                          : row.severity === "low"
                            ? "success"
                            : "warning"
                      }
                    >
                      {row.severity}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {row.locationName ?? "—"}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No incidents match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
