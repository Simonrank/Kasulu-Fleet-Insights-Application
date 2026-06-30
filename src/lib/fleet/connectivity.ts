import type { ConnectivityFilter } from "@/lib/types";

export type ConnectivityBand =
  | "updating"
  | "hours_4_24"
  | "hours_24_48"
  | "hours_48_plus"
  | "unknown";

/** Mutually exclusive connectivity buckets — each unit counted once; sums to fleet total. */
export type ConnectivityBandCounts = {
  /** Last message within 4 hours */
  updating: number;
  /** Last message between 4 and 24 hours ago */
  staleOver4Hours: number;
  /** Last message between 24 and 48 hours ago */
  staleOver24Hours: number;
  /** Last message more than 48 hours ago */
  staleOver48Hours: number;
  unknown: number;
};

const HOUR_MS = 60 * 60 * 1000;

export function emptyConnectivityBandCounts(): ConnectivityBandCounts {
  return {
    updating: 0,
    staleOver4Hours: 0,
    staleOver24Hours: 0,
    staleOver48Hours: 0,
    unknown: 0,
  };
}

export function staleAgeHours(
  lastMessageAt: Date | null,
  now: Date = new Date()
): number | null {
  if (!lastMessageAt) return null;
  return (now.getTime() - lastMessageAt.getTime()) / HOUR_MS;
}

/** Exclusive band for badges (fine-grained stale window). */
export function connectivityBand(
  lastMessageAt: Date | null,
  now: Date = new Date()
): ConnectivityBand {
  if (!lastMessageAt) return "unknown";

  const ageMs = now.getTime() - lastMessageAt.getTime();
  if (ageMs <= 4 * HOUR_MS) return "updating";
  if (ageMs <= 24 * HOUR_MS) return "hours_4_24";
  if (ageMs <= 48 * HOUR_MS) return "hours_24_48";
  return "hours_48_plus";
}

export function isUnitUpdating(lastMessageAt: Date | null): boolean {
  const age = staleAgeHours(lastMessageAt);
  return age != null && age <= 4;
}

export function tallyConnectivityFromLastMessages(
  messages: (Date | null)[],
  now: Date = new Date()
): ConnectivityBandCounts {
  const counts = emptyConnectivityBandCounts();

  for (const msg of messages) {
    switch (connectivityBand(msg, now)) {
      case "updating":
        counts.updating += 1;
        break;
      case "hours_4_24":
        counts.staleOver4Hours += 1;
        break;
      case "hours_24_48":
        counts.staleOver24Hours += 1;
        break;
      case "hours_48_plus":
        counts.staleOver48Hours += 1;
        break;
      case "unknown":
        counts.unknown += 1;
        break;
    }
  }

  return counts;
}

export function connectivityBandLabel(band: ConnectivityBand): string {
  switch (band) {
    case "updating":
      return "Updating";
    case "hours_4_24":
      return "4–24 hours";
    case "hours_24_48":
      return "24–48 hours";
    case "hours_48_plus":
      return "Above 48 hours";
    case "unknown":
      return "No last message";
  }
}

export function connectivityStaleLabel(
  filter: Exclude<
    ConnectivityFilter,
    "all" | "non_updating" | "unknown" | "updating"
  >
): string {
  switch (filter) {
    case "stale_over_4h":
      return connectivityBandLabel("hours_4_24");
    case "stale_over_24h":
      return connectivityBandLabel("hours_24_48");
    case "stale_over_48h":
      return connectivityBandLabel("hours_48_plus");
    default:
      return filter;
  }
}

export function connectivityBandDetail(band: ConnectivityBand): string {
  switch (band) {
    case "updating":
      return "Last message within 4 hours";
    case "hours_4_24":
      return "Last message between 4 and 24 hours ago";
    case "hours_24_48":
      return "Last message between 24 and 48 hours ago";
    case "hours_48_plus":
      return "Last message more than 48 hours ago";
    case "unknown":
      return "Last message time not recorded";
  }
}

export function matchesConnectivityFilter(
  unit: { lastMessageAt: string | null; connectivityBand: ConnectivityBand },
  filter: ConnectivityFilter
): boolean {
  if (filter === "all") return true;

  const age = staleAgeHours(
    unit.lastMessageAt ? new Date(unit.lastMessageAt) : null
  );

  if (filter === "unknown") return age === null;
  if (filter === "updating") return unit.connectivityBand === "updating";
  if (filter === "stale_over_4h") return unit.connectivityBand === "hours_4_24";
  if (filter === "stale_over_24h") return unit.connectivityBand === "hours_24_48";
  if (filter === "stale_over_48h") return unit.connectivityBand === "hours_48_plus";
  if (filter === "non_updating") return unit.connectivityBand !== "updating";

  return unit.connectivityBand === filter;
}

export function connectivityBandBadgeVariant(
  band: ConnectivityBand
): "success" | "warning" | "destructive" | "outline" {
  switch (band) {
    case "updating":
      return "success";
    case "hours_4_24":
      return "warning";
    case "hours_24_48":
      return "warning";
    case "hours_48_plus":
    case "unknown":
      return "destructive";
  }
}
