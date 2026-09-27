/**
 * Ticket BH / Q.1 — overnight open-hours unit smoke (no server required).
 * Run: npx tsx scripts/bh-overnight-smoke.ts
 */
import { fromZonedTime } from "date-fns-tz";
import {
  validateHourRow,
  validateWeekly,
  evaluateOpenState,
  emptyWeekly,
  type WeeklyHourRow,
} from "../src/lib/open-hours";

const TZ = "America/Denver";
const results: string[] = [];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  results.push("PASS: " + msg);
}

function at(ymd: string, hhmm: string): Date {
  return fromZonedTime(`${ymd} ${hhmm}:00`, TZ);
}

function friOvernightWeekly(): WeeklyHourRow[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday === 5
      ? { weekday, openTime: "22:00", closeTime: "02:00" }
      : { weekday, openTime: null, closeTime: null }
  );
}

function main() {
  assert(
    validateHourRow({ weekday: 5, openTime: "22:00", closeTime: "02:00" }).ok ===
      true,
    "validate overnight Fri 22:00–02:00"
  );
  assert(
    validateHourRow({ weekday: 1, openTime: "09:00", closeTime: "17:00" }).ok ===
      true,
    "validate same-day"
  );
  assert(
    validateHourRow({ weekday: 1, openTime: "09:00", closeTime: "09:00" }).ok ===
      false,
    "reject zero-length"
  );
  assert(validateWeekly(friOvernightWeekly()).ok === true, "validateWeekly");

  const weekly = friOvernightWeekly();
  const fri23 = evaluateOpenState({
    timezone: TZ,
    weekly,
    alwaysOpen: false,
    forceLiveUntil: null,
    now: at("2026-09-25", "23:00"),
  });
  assert(fri23.isOpenNow && fri23.reason === "within_hours", "Fri 23:00 open");

  const sat01 = evaluateOpenState({
    timezone: TZ,
    weekly,
    alwaysOpen: false,
    forceLiveUntil: null,
    now: at("2026-09-26", "01:00"),
  });
  assert(sat01.isOpenNow && sat01.reason === "within_hours", "Sat 01:00 open");

  const sat03 = evaluateOpenState({
    timezone: TZ,
    weekly,
    alwaysOpen: false,
    forceLiveUntil: null,
    now: at("2026-09-26", "03:00"),
  });
  assert(!sat03.isOpenNow, "Sat 03:00 closed");

  const fri21 = evaluateOpenState({
    timezone: TZ,
    weekly,
    alwaysOpen: false,
    forceLiveUntil: null,
    now: at("2026-09-25", "21:00"),
  });
  assert(
    !fri21.isOpenNow && fri21.reason === "outside_hours",
    "Fri 21:00 closed"
  );

  assert(
    !!fri23.nextCloseAt &&
      at("2026-09-26", "02:00").getTime() ===
        new Date(fri23.nextCloseAt).getTime(),
    "Fri 23 nextCloseAt = Sat 02:00"
  );

  const biz: WeeklyHourRow[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday <= 5
      ? { weekday, openTime: "09:00", closeTime: "17:00" }
      : { weekday, openTime: null, closeTime: null }
  );
  assert(
    evaluateOpenState({
      timezone: TZ,
      weekly: biz,
      alwaysOpen: false,
      forceLiveUntil: null,
      now: at("2026-09-21", "10:00"),
    }).isOpenNow,
    "Mon 10 business open"
  );
  assert(
    evaluateOpenState({
      timezone: TZ,
      weekly: emptyWeekly(),
      alwaysOpen: true,
      forceLiveUntil: null,
      now: at("2026-09-25", "03:00"),
    }).reason === "always_open",
    "alwaysOpen"
  );

  console.log(results.join("\n"));
  console.log(`\nOK ${results.length} assertions`);
}

main();
