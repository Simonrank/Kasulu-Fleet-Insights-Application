import type { TheftType } from "@/lib/types";

const RETURN_PIPE_KEYWORDS = [
  "return pipe",
  "return_pipe",
  "return line",
  "bypass",
  "pipe theft",
  "return-pipe",
];

const DIRECT_KEYWORDS = [
  "direct",
  "siphon",
  "tank drain",
  "drain",
  "theft",
];

export function classifyTheftType(description?: string | null): TheftType {
  const text = (description ?? "").toLowerCase();

  if (RETURN_PIPE_KEYWORDS.some((k) => text.includes(k))) {
    return "return_pipe";
  }

  if (DIRECT_KEYWORDS.some((k) => text.includes(k))) {
    return "direct";
  }

  // Default: classify unknown drains as direct
  return "direct";
}

export function parseWialonVolume(value: unknown): number {
  if (typeof value === "number") return Math.abs(value);
  if (typeof value !== "string") return 0;
  const match = value.match(/[\d.]+/);
  return match ? Math.abs(parseFloat(match[0])) : 0;
}

export function parseWialonDurationHours(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;

  // Formats: "7:09:23" or "2 days 3:04:05"
  const dayMatch = value.match(/(\d+)\s*days?/);
  const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
  const timePart = value.match(/(\d+):(\d+):(\d+)/);

  if (!timePart) return days * 24;

  const hours = parseInt(timePart[1], 10);
  const minutes = parseInt(timePart[2], 10);
  const seconds = parseInt(timePart[3], 10);

  return days * 24 + hours + minutes / 60 + seconds / 3600;
}

export function parseWialonDistanceKm(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const match = value.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

export function unixToDate(unix?: number): Date | null {
  if (!unix) return null;
  return new Date(unix * 1000);
}
