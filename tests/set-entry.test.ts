import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyUnitToExercise,
  exerciseUnit,
  isExercisePristine,
  matchesLastPerformance,
  prefillFromLastPerformance,
  propagateFirstSet,
  type GroupExerciseRow,
} from "../lib/training-form-state.ts";

const row = (reps: string, weight: string, unit: "kg" | "lb" = "kg") => ({ reps, weight, unit });
const blank = (): GroupExerciseRow => ({
  name: "",
  setsByStudent: { a: [row("10", ""), row("10", ""), row("10", "")], b: [row("10", ""), row("10", "")] },
});

test("單位改一次就套用到整個動作的每一組、每位學生", () => {
  const next = applyUnitToExercise(blank(), "lb");
  assert.ok(Object.values(next.setsByStudent).flat().every(set => set.unit === "lb"));
  assert.equal(exerciseUnit(next), "lb");
});

test("第一組打完會往下帶到空白的組別", () => {
  const sets = [row("10", ""), row("10", ""), row("10", "")];
  const next = propagateFirstSet(sets, "weight", "", "60");
  assert.deepEqual(next.map(set => set.weight), ["60", "60", "60"]);
});

test("改第一組時，原本跟著的組別一起更新", () => {
  const sets = [row("10", "60"), row("10", "60"), row("10", "60")];
  const next = propagateFirstSet(sets, "weight", "60", "65");
  assert.deepEqual(next.map(set => set.weight), ["65", "65", "65"]);
});

test("已經改成別的重量的組別不會被蓋掉（遞減組仍安全）", () => {
  const sets = [row("10", "60"), row("8", "55"), row("6", "50")];
  const next = propagateFirstSet(sets, "weight", "60", "65");
  assert.deepEqual(next.map(set => set.weight), ["65", "55", "50"]);
});

test("次數也用同一套規則", () => {
  const sets = [row("10", "60"), row("10", "60"), row("6", "60")];
  const next = propagateFirstSet(sets, "reps", "10", "12");
  assert.deepEqual(next.map(set => set.reps), ["12", "12", "6"]);
});

test("還沒填重量的動作才視為可帶入上次紀錄", () => {
  assert.ok(isExercisePristine(blank()));
  const typed = blank();
  typed.setsByStudent.a[0].weight = "60";
  assert.ok(!isExercisePristine(typed));
});

test("帶入上次紀錄時，每位學生各自帶自己的重量", () => {
  const last = {
    a: { 槓鈴深蹲: { occurredAt: "2026-08-17", sets: [row("10", "60"), row("10", "65")] } },
    b: { 槓鈴深蹲: { occurredAt: "2026-08-17", sets: [row("12", "30")] } },
  };
  const next = prefillFromLastPerformance(blank(), "槓鈴深蹲", last);
  assert.equal(next.name, "槓鈴深蹲");
  assert.deepEqual(next.setsByStudent.a.map(set => set.weight), ["60", "65"]);
  assert.deepEqual(next.setsByStudent.b.map(set => set.weight), ["30"]);
});

test("沒做過這個動作的學生維持原本的空白組數", () => {
  const last = { a: { 硬舉: { occurredAt: "2026-08-17", sets: [row("5", "80")] } } };
  const next = prefillFromLastPerformance(blank(), "硬舉", last);
  assert.deepEqual(next.setsByStudent.a.map(set => set.weight), ["80"]);
  assert.equal(next.setsByStudent.b.length, 2);
  assert.ok(next.setsByStudent.b.every(set => set.weight === ""));
});

test("帶入的紀錄是複本，改動不會回頭污染歷史資料", () => {
  const last = { a: { 硬舉: { occurredAt: "2026-08-17", sets: [row("5", "80")] } } };
  const next = prefillFromLastPerformance(blank(), "硬舉", last);
  next.setsByStudent.a[0].weight = "999";
  assert.equal(last.a.硬舉.sets[0].weight, "80");
});

test("換成另一個動作時，前一個動作帶進來的數字會被清掉", () => {
  const last = {
    a: { 槓鈴深蹲: { occurredAt: "2026-08-17", sets: [row("10", "60"), row("10", "65")] } },
    b: { 槓鈴深蹲: { occurredAt: "2026-08-17", sets: [row("12", "30"), row("12", "30")] } },
  };
  const prefilled = prefillFromLastPerformance(blank(), "槓鈴深蹲", last);
  assert.ok(matchesLastPerformance(prefilled, "槓鈴深蹲", last), "帶入後應視為未改動");
  const switched = prefillFromLastPerformance(prefilled, "硬舉", last, [row("10", ""), row("10", "")]);
  assert.ok(switched.setsByStudent.a.every(set => set.weight === ""), "沒做過的動作要是空白");
  assert.ok(switched.setsByStudent.b.every(set => set.weight === ""));
});

test("教練手動改過之後就不算「未改動」，不會被換動作洗掉", () => {
  const last = { a: { 槓鈴深蹲: { occurredAt: "2026-08-17", sets: [row("10", "60")] } }, b: {} };
  const prefilled = prefillFromLastPerformance(blank(), "槓鈴深蹲", last);
  prefilled.setsByStudent.a[0].weight = "70";
  assert.ok(!matchesLastPerformance(prefilled, "槓鈴深蹲", last));
});

test("完全空白的動作也算未改動，可以直接帶入", () => {
  assert.ok(matchesLastPerformance(blank(), "沒做過的動作", { a: {}, b: {} }));
});
