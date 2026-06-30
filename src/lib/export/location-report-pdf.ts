import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { appConfig } from "@/lib/config/env";
import type { UnitLatestRow } from "@/lib/types";

function formatLastMessage(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd.MM.yyyy HH:mm:ss");
}

function formatSpeed(speedKmh: number | null): string {
  if (speedKmh == null || speedKmh <= 0) return "—";
  return `${Math.round(speedKmh)} km/h`;
}

function sortBySpeed(rows: UnitLatestRow[]): UnitLatestRow[] {
  return [...rows].sort((a, b) => {
    const speedA = a.speedKmh ?? -1;
    const speedB = b.speedKmh ?? -1;
    if (speedB !== speedA) return speedB - speedA;
    return a.name.localeCompare(b.name);
  });
}

function createCurrentAssetLocationPdfDoc(rows: UnitLatestRow[]): jsPDF {
  const sorted = sortBySpeed(rows);
  const generatedAt = format(new Date(), "dd MMM yyyy HH:mm");

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text("Current asset location", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Live ControlRoom report · ${sorted.length} assets · sorted by speed`,
    14,
    21
  );
  doc.text(`Generated ${generatedAt} · ${appConfig.name}`, 14, 26);

  const tableBody = sorted.map((row) => [
    row.name,
    formatLastMessage(row.lastMessageAt),
    row.locationLabel ?? "—",
    formatSpeed(row.speedKmh),
  ]);

  autoTable(doc, {
    startY: 31,
    head: [["Asset", "Last message", "Location", "Speed"]],
    body: tableBody,
    theme: "plain",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold", textColor: [15, 23, 42] },
      1: { cellWidth: 40, fontStyle: "normal" },
      2: { cellWidth: 155, textColor: [37, 99, 235] },
      3: {
        cellWidth: 24,
        halign: "right",
        fontStyle: "bold",
        textColor: [15, 23, 42],
      },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, top: 14, bottom: 14 },
    didDrawPage: (data) => {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: "right" }
      );
    },
  });

  return doc;
}

/** PDF layout matching the on-screen Current asset location report. */
export function buildCurrentAssetLocationPdfBuffer(
  rows: UnitLatestRow[]
): Buffer {
  return Buffer.from(createCurrentAssetLocationPdfDoc(rows).output("arraybuffer"));
}

export function buildCurrentAssetLocationPdfBlob(rows: UnitLatestRow[]): Blob {
  return createCurrentAssetLocationPdfDoc(rows).output("blob");
}

export function locationsTableRows(
  rows: UnitLatestRow[]
): (string | number | null | undefined)[][] {
  return sortBySpeed(rows).map((row) => [
    row.name,
    row.lastMessageAt
      ? format(new Date(row.lastMessageAt), "dd.MM.yyyy HH:mm:ss")
      : "—",
    row.locationLabel ?? "—",
    formatSpeed(row.speedKmh),
  ]);
}
