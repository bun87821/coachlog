import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentDuration, appointmentEventBody, studentIdsFromDescription } from "../lib/calendar-event.ts";

const base = { notes: "", date: "2026-08-24", time: "19:30", duration: 60, appUrl: "https://coachlog.test" };

test("單人預約的標題與描述", () => {
  const body = appointmentEventBody({ ...base, studentIds: ["0902c759-b36b-40c9-8c20-0e07d1207cbd"], names: ["王小明"] });
  assert.equal(body.summary, "王小明｜私人教練課");
  assert.match(body.description, /^student:0902c759-b36b-40c9-8c20-0e07d1207cbd\n/);
  assert.match(body.description, /coachlog\.test\/students\/0902c759-b36b-40c9-8c20-0e07d1207cbd\n/);
});

test("多人預約列出所有人，連結帶著同伴", () => {
  const body = appointmentEventBody({ ...base, studentIds: ["0902c759-b36b-40c9-8c20-0e07d1207cbd", "7d1f0a44-2b19-4d55-9a80-1c3e5f6a7b8c"], names: ["王小明", "李小美"] });
  assert.equal(body.summary, "王小明、李小美｜私人教練課");
  assert.deepEqual(studentIdsFromDescription(body.description), ["0902c759-b36b-40c9-8c20-0e07d1207cbd", "7d1f0a44-2b19-4d55-9a80-1c3e5f6a7b8c"]);
  assert.match(body.description, /\/students\/0902c759-b36b-40c9-8c20-0e07d1207cbd\?with=7d1f0a44-2b19-4d55-9a80-1c3e5f6a7b8c/);
});

test("起訖時間以台北時間換算", () => {
  const body = appointmentEventBody({ ...base, studentIds: ["0902c759-b36b-40c9-8c20-0e07d1207cbd"], names: ["王小明"], duration: 90 });
  assert.equal(body.start.dateTime, "2026-08-24T11:30:00.000Z");
  assert.equal(body.end.dateTime, "2026-08-24T13:00:00.000Z");
});

test("備註接在描述最後", () => {
  const body = appointmentEventBody({ ...base, studentIds: ["0902c759-b36b-40c9-8c20-0e07d1207cbd"], names: ["王小明"], notes: "帶滾筒" });
  assert.match(body.description, /帶滾筒$/);
});

test("從事件描述推回課程長度", () => {
  assert.equal(appointmentDuration("2026-08-24T11:30:00Z", "2026-08-24T13:00:00Z"), 90);
  assert.equal(appointmentDuration(undefined, undefined), 60);
  assert.equal(appointmentDuration("2026-08-24T13:00:00Z", "2026-08-24T11:30:00Z"), 60);
});

test("沒有 student 標記的一般行事曆事件不會被當成課程", () => {
  assert.deepEqual(studentIdsFromDescription("看牙醫"), []);
  assert.deepEqual(studentIdsFromDescription(undefined), []);
});
