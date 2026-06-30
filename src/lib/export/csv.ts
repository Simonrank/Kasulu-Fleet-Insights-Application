/** Escape a value for CSV (RFC-style quoting). */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export type ExportFormat = "csv" | "xlsx" | "pdf";
export type ExportReportType = "fuel" | "violations" | "locations" | "utilization";

export async function fetchAndDownloadReport(
  type: ExportReportType,
  format: ExportFormat,
  from: string,
  to: string
): Promise<void> {
  const params = new URLSearchParams({ type, format, from, to });
  const res = await fetch(`/api/reports/export?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? "Export failed"
    );
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename =
    match?.[1] ??
    `kasulu-${type}-report-${formatExportStamp(new Date())}.${format}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatExportStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}
