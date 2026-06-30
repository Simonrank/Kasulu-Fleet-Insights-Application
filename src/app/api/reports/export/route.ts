import { NextResponse } from "next/server";
import {
  buildExportBuffer,
  exportExtension,
  type ExportFormat,
} from "@/lib/export/formats";
import {
  exportFilename,
  getReportRows,
  buildLocationsPdf,
  reportTitle,
  type ExportReportType,
} from "@/lib/services/report-exports";
import { withSheetData } from "@/lib/google-sheets/with-sheet-data";

const VALID_TYPES = new Set<ExportReportType>([
  "fuel",
  "violations",
  "locations",
]);

const VALID_FORMATS = new Set<ExportFormat>(["csv", "xlsx", "pdf"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as ExportReportType | null;
    const format = (searchParams.get("format") ?? "csv") as ExportFormat;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: "type must be fuel, violations, or locations" },
        { status: 400 }
      );
    }

    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json(
        { error: "format must be csv, xlsx, or pdf" },
        { status: 400 }
      );
    }

    if (type !== "locations" && (!fromParam || !toParam)) {
      return NextResponse.json(
        { error: "from and to are required for fuel and violations exports" },
        { status: 400 }
      );
    }

    const from = fromParam ? new Date(fromParam) : new Date();
    const to = toParam ? new Date(toParam) : new Date();

    if (type === "locations") {
      if (format === "pdf") {
        const buffer = await buildLocationsPdf();
        const filename = exportFilename(type, from, to, "pdf");
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }

      const rows = await getReportRows(type, from, to);
      const { buffer, contentType } = buildExportBuffer(
        format,
        rows,
        reportTitle(type)
      );
      const ext = exportExtension(format);
      const filename = exportFilename(type, from, to, ext);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return await withSheetData(async () => {
      const rows = await getReportRows(type, from, to);
      const { buffer, contentType } = buildExportBuffer(
        format,
        rows,
        reportTitle(type)
      );
      const ext = exportExtension(format);
      const filename = exportFilename(type, from, to, ext);

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
