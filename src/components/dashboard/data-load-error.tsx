"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  message: string;
  hints?: string[];
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
};

export function DataLoadError({
  title = "Could not load data",
  message,
  hints = [],
  onRetry,
  isRetrying = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "mx-auto max-w-lg rounded-2xl border border-rose-200/80 bg-white p-6 shadow-sm md:p-8",
        className
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50">
          <AlertCircle className="h-5 w-5 text-rose-600" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{message}</p>
          {hints.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-slate-500">
              {hints.map((hint) => (
                <li key={hint} className="flex gap-2">
                  <span className="text-slate-300">•</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
            >
              <RefreshCw
                className={cn("h-4 w-4", isRetrying && "animate-spin")}
              />
              {isRetrying ? "Retrying…" : "Try again"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const VERCEL_SHEETS_HINTS = [
  "Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SHEETS_FLEET_RANGE in Vercel → Settings → Environment Variables.",
  "Set GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_SERVICE_ACCOUNT_KEY) to the full service account JSON — not a file path.",
  "Use the full column range: Sheet1!A:M — capped ranges (e.g. A1:M1000) miss data after sorting.",
  "Share the Google Sheet with the service account client_email as Viewer.",
];
