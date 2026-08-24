import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTaipeiDateTime } from "../lib/csv.ts";

// 與 BookingCalendar 已預約列相同的組法
const bookingHref = (studentIds: string[], startDateTime?: string) => {
  const params = new URLSearchParams();
  if (studentIds.length > 1) params.set("with", studentIds.slice(1).join(","));
  if (startDateTime) params.set("at", formatTaipeiDateTime(startDateTime).replace(" ", "T"));
  const query = params.toString();
  return `/students/${studentIds[0]}${query ? `?${query}` : ""}#new-workout`;
};

const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

test("單人預約帶入上課時間", () => {
  const href = bookingHref(["s1"], "2026-08-24T19:30:00+08:00");
  assert.equal(href, "/students/s1?at=2026-08-24T19%3A30#new-workout");
  assert.match(decodeURIComponent(new URL(href, "https://x").searchParams.get("at")!), pattern);
});

test("多人預約同時帶入同伴與時間", () => {
  const href = bookingHref(["s1", "s2", "s3"], "2026-08-24T19:30:00+08:00");
  const params = new URL(href, "https://x").searchParams;
  assert.equal(params.get("with"), "s2,s3");
  assert.equal(params.get("at"), "2026-08-24T19:30");
});

test("非台北時區的事件換算成台北時間", () => {
  const params = new URL(bookingHref(["s1"], "2026-08-24T11:30:00Z"), "https://x").searchParams;
  assert.equal(params.get("at"), "2026-08-24T19:30");
});

test("全天事件沒有開始時間時不帶 at", () => {
  assert.equal(bookingHref(["s1"]), "/students/s1#new-workout");
});

test("學生頁只接受合法的時間格式", () => {
  const accepted = (value: string) => pattern.test(value);
  assert.ok(accepted("2026-08-24T19:30"));
  assert.ok(!accepted("2026-08-24 19:30"));
  assert.ok(!accepted("../etc/passwd"));
  assert.ok(!accepted("2026-08-24T19:30:00"));
});
