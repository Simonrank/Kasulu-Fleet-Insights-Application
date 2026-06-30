import type { WialonUnit } from "@/lib/types";
import { hasWialonToken, isTelematicsConfigured, wialonConfig } from "@/lib/config/env";
import type {
  WialonReportResult,
  WialonReportTable,
  WialonResultRow,
} from "@/lib/wialon/report-types";

type WialonResponse<T> = T & { error?: number };

const DEFAULT_API_URL = "https://hst-api.wialon.com/wialon/ajax.html";
const TZ_OFFSET = 10800 | 0x08000000;
const POLL_MS = 2000;
const MAX_WAIT_MS = 300_000;

export class WialonClient {
  private sid: string | null = null;
  private readonly apiUrl: string;
  private readonly token: string;

  constructor(token?: string, apiUrl?: string) {
    this.token = token ?? process.env.WIALON_TOKEN ?? "";
    this.apiUrl = apiUrl ?? process.env.WIALON_API_URL ?? DEFAULT_API_URL;

    if (!this.token) {
      throw new Error("WIALON_TOKEN is not configured");
    }
  }

  private async request<T>(
    svc: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const body = new URLSearchParams({
      svc,
      params: JSON.stringify(params),
    });

    if (this.sid) {
      body.set("sid", this.sid);
    }

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Wialon HTTP error: ${response.status}`);
    }

    const data = (await response.json()) as WialonResponse<T>;

    if (typeof data.error === "number" && data.error !== 0) {
      throw new Error(`Wialon API error code: ${data.error} on ${svc}`);
    }

    return data;
  }

  async login(): Promise<string> {
    const data = await this.request<{ eid?: string }>("token/login", {
      token: this.token,
    });

    if (!data.eid) {
      throw new Error("Wialon login failed: no session id");
    }

    this.sid = data.eid;
    return data.eid;
  }

  async logout(): Promise<void> {
    if (!this.sid) return;
    try {
      await this.request("core/logout", {});
    } finally {
      this.sid = null;
    }
  }

  async setLocale(): Promise<void> {
    await this.ensureSession();
    await this.request("render/set_locale", {
      tzOffset: TZ_OFFSET,
      language: "en",
      formatDate: "%Y-%m-%E %H:%M:%S",
    });
  }

  async getUnits(): Promise<WialonUnit[]> {
    await this.ensureSession();

    const data = await this.request<{ items?: WialonUnit[] }>(
      "core/search_items",
      {
        spec: {
          itemsType: "avl_unit",
          propName: "sys_name",
          propValueMask: "*",
          sortType: "sys_name",
        },
        force: 1,
        flags: 1 + 1024 + 4194304,
        from: 0,
        to: 0,
      }
    );

    return data.items ?? [];
  }

  private execReportParams(
    intervalFrom: number,
    intervalTo: number,
    reportObjectId: number,
    remoteExec: number,
    report?: { resourceId: number; templateId: number }
  ) {
    return {
      reportResourceId: report?.resourceId ?? Number(wialonConfig.reportResourceId),
      reportTemplateId: report?.templateId ?? Number(wialonConfig.reportTemplateId),
      reportObjectId,
      reportObjectSecId: 0,
      interval: { from: intervalFrom, to: intervalTo, flags: 0 },
      remoteExec,
    };
  }

  private async waitReportDone(): Promise<void> {
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      const status = await this.request<{ status?: number }>(
        "report/get_report_status",
        {}
      );
      const code = status.status ?? 0;

      if (code === 4) return;
      if (code === 8 || code === 16) {
        throw new Error(`Wialon report failed with status ${code}`);
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    throw new Error("Wialon report timed out");
  }

  /** Run a group/unit report for a unix interval and return parsed result tables. */
  async runGroupReport(
    intervalFrom: number,
    intervalTo: number,
    reportObjectId: number,
    report?: { resourceId: number; templateId: number }
  ): Promise<WialonReportResult> {
    await this.ensureSession();

    await this.request("report/cleanup_result", {});

    const sync = await this.request<WialonReportResult>(
      "report/exec_report",
      this.execReportParams(intervalFrom, intervalTo, reportObjectId, 0, report)
    );

    if (sync.reportResult) {
      return sync;
    }

    await this.request(
      "report/exec_report",
      this.execReportParams(intervalFrom, intervalTo, reportObjectId, 1, report)
    );
    await this.waitReportDone();

    return this.request<WialonReportResult>("report/apply_report_result", {});
  }

  async fetchTableRows(
    tableIndex: number,
    table: WialonReportTable
  ): Promise<WialonResultRow[]> {
    await this.ensureSession();

    const rows = table.rows ?? 0;
    if (rows === 0) return [];

    const level = table.level ?? 1;

    if (level <= 1) {
      return this.request<WialonResultRow[]>("report/get_result_rows", {
        tableIndex,
        indexFrom: 0,
        indexTo: rows - 1,
      });
    }

    return this.request<WialonResultRow[]>("report/select_result_rows", {
      tableIndex,
      config: {
        type: "range",
        data: { from: 0, to: rows - 1, level, flat: 1 },
      },
    });
  }

  /** @deprecated Use runGroupReport — kept for backward compatibility */
  async execReport(params: {
    reportResourceId: number;
    reportTemplateId: number;
    reportObjectId: number;
    from: number;
    to: number;
  }): Promise<unknown> {
    await this.ensureSession();
    await this.request("report/cleanup_result", {});
    return this.request("report/exec_report", {
      reportResourceId: params.reportResourceId,
      reportTemplateId: params.reportTemplateId,
      reportObjectId: params.reportObjectId,
      reportObjectSecId: 0,
      interval: {
        from: params.from,
        to: params.to,
        flags: 0,
      },
    });
  }

  /** @deprecated Use fetchTableRows */
  async getReportRows(indexFrom = 0, indexTo = 500): Promise<unknown> {
    await this.ensureSession();
    return this.request("report/get_result_rows", {
      tableIndex: 0,
      indexFrom,
      indexTo,
    });
  }

  private async ensureSession(): Promise<void> {
    if (!this.sid) {
      await this.login();
    }
  }
}

export function createWialonClient(requireFleetReport = true): WialonClient | null {
  const configured = requireFleetReport
    ? isTelematicsConfigured()
    : hasWialonToken();
  if (!configured) {
    return null;
  }
  return new WialonClient(wialonConfig.token, wialonConfig.apiUrl);
}
