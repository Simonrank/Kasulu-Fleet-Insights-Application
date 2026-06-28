import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { rowsToCsv } from "@/lib/export/csv";

export type ExportFormat = "csv" | "xlsx" | "pdf";

export function rowsToXlsxBuffer(
  rows: (string | number | null | undefined)[][],
  sheetName = "Report"
): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  );
}

export function rowsToPdfBuffer(
  rows: (string | number | null | undefined)[][],
  title: string
): Buffer {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  const tableRows = rows.map((row) =>
    row.map((cell) => (cell == null ? "" : String(cell)))
  );

  autoTable(doc, {
    startY: 22,
    head: [],
    body: tableRows,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [13, 148, 136] },
    margin: { left: 10, right: 10 },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

export function buildExportBuffer(
  format: ExportFormat,
  rows: (string | number | null | undefined)[][],
  title: string
): { buffer: Buffer; contentType: string } {
  switch (format) {
    case "csv":
      return {
        buffer: Buffer.from("\uFEFF" + rowsToCsv(rows), "utf-8"),
        contentType: "text/csv; charset=utf-8",
      };
    case "xlsx":
      return {
        buffer: rowsToXlsxBuffer(rows, title),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    case "pdf":
      return {
        buffer: rowsToPdfBuffer(rows, title),
        contentType: "application/pdf",
      };
  }
}

export function exportExtension(format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "csv";
    case "xlsx":
      return "xlsx";
    case "pdf":
      return "pdf";
  }
}
