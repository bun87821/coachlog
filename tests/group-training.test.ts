import assert from "node:assert/strict";
import { test } from "node:test";
import {
  exerciseParticipants,
  exercisesFromSessionsPayload,
  normalizeTrainingDraft,
  studentExercises,
  toggleExerciseParticipant,
  trainingDraftKey,
  trainingDraftKeyFor,
  trainingSessionPayload,
  type GroupExerciseRow,
} from "../lib/training-form-state.ts";

const sets = (weight: string) => [{ reps: "10", weight, unit: "kg" as const }];
const squat = (): GroupExerciseRow => ({ name: "槓鈴深蹲", setsByStudent: { a: sets("60"), b: sets("30") } });
const participants = [{ id: "a", name: "王小明" }, { id: "b", name: "李小美" }];

test("單人課沿用原本的草稿 key，多人課的 key 與學生順序無關", () => {
  assert.equal(trainingDraftKeyFor("cloud", ["a"]), trainingDraftKey("cloud", "a"));
  assert.equal(trainingDraftKeyFor("cloud", ["b", "a"]), trainingDraftKeyFor("cloud", ["a", "b"]));
  assert.notEqual(trainingDraftKeyFor("cloud", ["a", "b"]), trainingDraftKeyFor("cloud", ["a"]));
});

test("同一個動作可以讓兩位學生各自留下不同重量", () => {
  const rows = [squat()];
  assert.deepEqual(studentExercises(rows, "a"), [{ name: "槓鈴深蹲", sets: sets("60") }]);
  assert.deepEqual(studentExercises(rows, "b"), [{ name: "槓鈴深蹲", sets: sets("30") }]);
});

test("取消參與者後，該動作不會出現在他的紀錄裡", () => {
  const exercise = toggleExerciseParticipant(squat(), "b", sets(""));
  assert.deepEqual(exerciseParticipants(exercise), ["a"]);
  assert.deepEqual(studentExercises([exercise], "b"), []);
});

test("完全沒有紀錄的學生不會被建立空堂課", () => {
  const rows = [toggleExerciseParticipant(squat(), "b", sets(""))];
  const payload = trainingSessionPayload(participants, rows, { a: "深蹲放慢", b: "今天請假" });
  assert.equal(payload.length, 1);
  assert.equal(payload[0].studentId, "a");
  assert.equal(payload[0].notes, "深蹲放慢");
});

test("每位學生各自帶走自己的備註", () => {
  const payload = trainingSessionPayload(participants, [squat()], { a: "深蹲放慢", b: "左膝不適" });
  assert.deepEqual(payload.map(entry => [entry.studentId, entry.notes]), [["a", "深蹲放慢"], ["b", "左膝不適"]]);
});

test("舊版單人草稿可以直接接回新的表單", () => {
  const legacy = { date: "2026-08-24T19:00", notes: "深蹲放慢", exercises: [{ name: "槓鈴深蹲", sets: sets("60") }] };
  const draft = normalizeTrainingDraft(legacy, ["a"]);
  assert.equal(draft?.notesByStudent.a, "深蹲放慢");
  assert.deepEqual(draft?.exercises[0].setsByStudent, { a: sets("60") });
});

test("草稿裡已經不在這堂課的學生會被丟掉", () => {
  const stored = { date: "", notesByStudent: { a: "留下", c: "已移除" }, exercises: [{ name: "槓鈴深蹲", setsByStudent: { a: sets("60"), c: sets("40") } }] };
  const draft = normalizeTrainingDraft(stored, ["a", "b"]);
  assert.deepEqual(Object.keys(draft?.exercises[0].setsByStudent || {}), ["a"]);
  assert.deepEqual(Object.keys(draft?.notesByStudent || {}), ["a"]);
});

test("沒有任何學生留下紀錄的草稿視為空草稿", () => {
  const stored = { date: "", notesByStudent: {}, exercises: [{ name: "槓鈴深蹲", setsByStudent: {} }] };
  assert.equal(normalizeTrainingDraft(stored, ["a"]), null);
});

test("編輯既有課堂時，從表單送出的 sessionsJson 取得該學生的動作", () => {
  const payload = trainingSessionPayload(participants, [squat()], { a: "備註" });
  const rows = exercisesFromSessionsPayload(JSON.stringify(payload), "a");
  assert.deepEqual(rows, [{ name: "槓鈴深蹲", sets: sets("60") }]);
  assert.deepEqual(exercisesFromSessionsPayload(JSON.stringify(payload), "b"), [{ name: "槓鈴深蹲", sets: sets("30") }]);
});

test("表單沒有送出訓練內容時給出可讀訊息，而不是伺服器錯誤", () => {
  assert.throws(() => exercisesFromSessionsPayload("", "a"), /格式不正確/);
  assert.throws(() => exercisesFromSessionsPayload("{}", "a"), /格式不正確/);
});

test("找不到該學生的內容時回傳空陣列，交由動作驗證擋下", () => {
  assert.deepEqual(exercisesFromSessionsPayload("[]", "a"), []);
});
