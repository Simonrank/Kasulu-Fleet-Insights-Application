import { format as formatDate } from "date-fns";
import * as XLSX from "xlsx";
import { rowsToCsv, type ExportFormat } from "@/lib/export/csv";
import {
  buildCurrentAssetLocationPdfBlob,
  locationsTableRows,
} from "@/lib/export/location-report-pdf";
import { appConfig } from "@/lib/config/env";
import type { UnitLatestRow } from "@/lib/types";

function locationsFilename(format: ExportFormat): string {
  const stamp = formatDate(new Date(), "yyyy-MM-dd");
  return `kasulu-current-asset-location_${stamp}.${format}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Instant export from data already shown on screen — no Wialon round-trip. */
export function downloadLocationsReport(
  format: ExportFormat,
  rows: UnitLatestRow[]
): void {
  if (rows.length === 0) {
    throw new Error("No asset location data to export");
  }

  const filename = locationsFilename(format);
  const tableRows = locationsTableRows(rows);
  const header = ["Asset", "Last message", "Location", "Speed"];

  if (format === "pdf") {
    triggerDownload(buildCurrentAssetLocationPdfBlob(rows), filename);
    return;
  }

  if (format === "csv") {
    const csv = rowsToCsv([header, ...tableRows]);
    triggerDownload(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
      filename
    );
    return;
  }

  const sheetRows = [
    ["Current asset location"],
    [`${appConfig.name} — ${appConfig.orgLabel}`],
    ["Generated", formatDate(new Date(), "dd MMM yyyy HH:mm")],
    ["Assets", rows.length],
    [],
    header,
    ...tableRows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Current asset location");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
}
