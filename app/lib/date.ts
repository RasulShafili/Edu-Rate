export type TemporalStatus = "upcoming" | "ongoing" | "finished";
export type DeadlineStatus = "open" | "closed";

const AZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avqust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
] as const;

export function getTemporalStatus(
  startAt: string,
  endAt: string,
  now: Date = new Date(),
): TemporalStatus {
  const start = toTimestamp(startAt);
  const end = toTimestamp(endAt);
  const current = now.getTime();

  if (current < start) return "upcoming";
  if (current <= end) return "ongoing";
  return "finished";
}

export function getDeadlineStatus(
  deadline: string,
  now: Date = new Date(),
): DeadlineStatus {
  return now.getTime() <= toTimestamp(deadline) ? "open" : "closed";
}

export function isThisWeek(value: string, now: Date = new Date()): boolean {
  const target = new Date(toTimestamp(value));
  const start = new Date(now);
  const day = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return target >= start && target < end;
}

export function formatAzDate(value: string): string {
  const { day, month, year } = getStableDateParts(value);
  return `${day} ${AZ_MONTHS[month - 1]} ${year}`;
}

/**
 * Ay adlarını kənardan alır ki, tarix istifadəçinin seçdiyi dildə yazılsın.
 * `formatAzDate` yalnız azərbaycanca qaytarır və hələ də bir neçə yerdə
 * işlədilir; bu funksiya tərcümə lüğəti ilə birlikdə istifadə olunur.
 */
export function formatDateWithMonths(value: string, months: readonly string[]): string {
  const { day, month, year } = getStableDateParts(value);
  return `${day} ${months[month - 1] ?? month} ${year}`;
}

/** "10 avqust · 10:20" — ay adi lugetden gelir. */
export function formatDateTimeWithMonths(value: string, months: readonly string[]): string {
  const { day, month, hour, minute } = getStableDateParts(value);
  return `${day} ${months[month - 1] ?? month} · ${hour}:${minute}`;
}

export function formatAzDateTime(value: string): string {
  const { day, month, hour, minute } = getStableDateParts(value);
  return `${day} ${AZ_MONTHS[month - 1]}, ${hour}:${minute}`;
}

export function sortByStartAt<T extends { startAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => toTimestamp(left.startAt) - toTimestamp(right.startAt));
}

export function getUpcomingItems<T extends { startAt: string; endAt: string }>(
  items: readonly T[],
  now: Date = new Date(),
): T[] {
  return sortByStartAt(items).filter(
    (item) => getTemporalStatus(item.startAt, item.endAt, now) !== "finished",
  );
}

export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  return now.getTime() > toTimestamp(expiresAt);
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new RangeError(`Etibarsız tarix: ${value}`);
  }
  return timestamp;
}

function getStableDateParts(value: string) {
  toTimestamp(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!match) throw new RangeError(`Etibarsız ISO tarixi: ${value}`);

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4] ?? "00",
    minute: match[5] ?? "00",
  };
}
