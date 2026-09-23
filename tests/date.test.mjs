import assert from "node:assert/strict";
import test from "node:test";
import { formatDateTimeWithMonths, formatDateWithMonths, getDeadlineStatus, getTemporalStatus, getUpcomingItems, isExpired, isThisWeek } from "../app/lib/date.ts";

const now = new Date("2026-07-29T12:00:00+04:00");

test("tədbir statusu sərhəd anlarında düzgün hesablanır", () => {
  assert.equal(getTemporalStatus("2026-07-29T13:00:00+04:00", "2026-07-29T14:00:00+04:00", now), "upcoming");
  assert.equal(getTemporalStatus("2026-07-29T11:00:00+04:00", "2026-07-29T12:00:00+04:00", now), "ongoing");
  assert.equal(getTemporalStatus("2026-07-29T10:00:00+04:00", "2026-07-29T11:59:59+04:00", now), "finished");
});

test("son qeydiyyat anı daxil olmaqla açıq sayılır", () => {
  assert.equal(getDeadlineStatus("2026-07-29T12:00:00+04:00", now), "open");
  assert.equal(getDeadlineStatus("2026-07-29T11:59:59+04:00", now), "closed");
});

test("həftə və arxiv sərhədləri sabitdir", () => {
  // isThisWeek həftəni baxanın lokal vaxtında hesablayır. Ofsetsiz sətir də lokal
  // vaxt kimi oxunur, ona görə test hər saat qurşağında eyni nəticə verir
  // (CI UTC-dədir; +04:00 ilə yazılanda bazar ertəsi 00:00 orada hələ bazar idi).
  const localNow = new Date(2026, 6, 29, 12, 0, 0);
  assert.equal(isThisWeek("2026-07-26T23:59:59", localNow), false);
  assert.equal(isThisWeek("2026-07-27T00:00:00", localNow), true);
  assert.equal(isThisWeek("2026-08-02T23:59:59", localNow), true);
  assert.equal(isThisWeek("2026-08-03T00:00:00", localNow), false);
  assert.equal(isExpired("2026-07-29T12:00:00+04:00", now), false);
  assert.equal(isExpired("2026-07-29T11:59:59+04:00", now), true);
});

test("gələcək və davam edən tədbirlər xronoloji sıralanır", () => {
  const items = [
    { id: "later", startAt: "2026-08-02T10:00:00+04:00", endAt: "2026-08-02T12:00:00+04:00" },
    { id: "past", startAt: "2026-07-20T10:00:00+04:00", endAt: "2026-07-20T12:00:00+04:00" },
    { id: "soon", startAt: "2026-07-30T10:00:00+04:00", endAt: "2026-07-30T12:00:00+04:00" },
  ];
  assert.deepEqual(getUpcomingItems(items, now).map((item) => item.id), ["soon", "later"]);
});

test("etibarsız tarix səssizcə qəbul edilmir", () => {
  assert.throws(() => getTemporalStatus("yoxdur", "2026-08-01", now), RangeError);
});

test("tarix Bakı vaxtı ilə yazılır, prosesin saat qurşağından asılı deyil", () => {
  const months = Array.from({ length: 12 }, (_, index) => `m${index + 1}`);
  // Backend UTC qaytarır; əvvəl saat olduğu kimi (4 saat geri) yazılırdı.
  assert.equal(formatDateTimeWithMonths("2026-09-23T18:48:00.000Z", months), "23 m9 · 22:48");
  // 20:00Z-dən sonrası Bakıda növbəti gündür.
  assert.equal(formatDateTimeWithMonths("2026-09-30T21:30:00.000Z", months), "1 m10 · 01:30");
  assert.equal(formatDateWithMonths("2026-12-31T20:15:00.000Z", months), "1 m1 2027");
  assert.equal(formatDateWithMonths("2026-07-29T12:00:00+04:00", months), "29 m7 2026");
});
