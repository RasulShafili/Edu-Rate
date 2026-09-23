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

/**
 * Tarix hissələri həmişə Bakı vaxtı ilə. Əvvəl ISO sətri olduğu kimi oxunurdu;
 * backend UTC ("…T18:48Z") qaytardığı üçün sayt saatı Bakıdan 4 saat geri
 * yazırdı, 00:00–04:00 arasında isə günü də səhv göstərirdi. Saat qurşağı sabit
 * verildiyi üçün server və brauzer eyni nəticəni verir — hidrasiya pozulmur.
 */
function getStableDateParts(value: string) {
  toTimestamp(value);
  const parts = bakuDateParts(value);
  const [hour = "00", minute = "00"] = parts.time.split(":");
  return { year: parts.year, month: parts.month, day: Number(parts.day), hour, minute };
}

const bakuFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Tarix hissələri Bakı vaxtı ilə, yalnız rəqəm kimi. Ay adı lüğətdən gəlir —
 * `Intl("az-AZ")` bəzi Chromium-larda ay adlarını qaytarmır. Əvvəl drawer tarixi
 * ISO sətrindən (UTC) oxuyurdu: 00:00–04:00 arası başlayan tədbir kartda bir gün,
 * drawer-də əvvəlki gün yazılırdı.
 */
export function bakuDateParts(value: string) {
  const parts = Object.fromEntries(
    bakuFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return {
    day: parts.day ?? "",
    month: Number(parts.month) || 1,
    year: Number(parts.year) || 0,
    time: `${parts.hour ?? "00"}:${parts.minute ?? "00"}`,
  };
}
