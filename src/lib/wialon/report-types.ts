export type WialonReportCell = string | { t?: string; v?: unknown };

export type WialonReportTable = {
  label?: string;
  name?: string;
  header?: string[];
  rows?: number;
  level?: number;
};

export type WialonReportResult = {
  reportResult?: {
    tables?: WialonReportTable[];
  };
};

export type WialonResultRow = {
  c?: WialonReportCell[];
};
