import test from "node:test";
import assert from "node:assert/strict";
import {
  copyFirstSetWeight,
  finalizeTrainingDraft,
  readTrainingDraft,
  trainingDraftKey,
  writeTrainingDraft,
  type TrainingDraft,
} from "../lib/training-form-state.ts";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const sampleDraft: TrainingDraft = {
  date: "2026-08-17T19:00",
  notes: "膝蓋狀況良好",
  exercises: [{
    name: "槓鈴深蹲",
    sets: [
      { reps: "8", weight: "60", unit: "kg" },
      { reps: "10", weight: "", unit: "lb" },
    ],
  }],
};

test("草稿鍵值依使用模式與學生隔離", () => {
  assert.equal(trainingDraftKey("cloud", "student-a"), "coachlog-training-draft-v1:cloud:student-a");
  assert.notEqual(trainingDraftKey("cloud", "student-a"), trainingDraftKey("local", "student-a"));
  assert.notEqual(trainingDraftKey("cloud", "student-a"), trainingDraftKey("cloud", "student-b"));
});

test("草稿可以寫入、讀回與忽略損壞資料", () => {
  const storage = createMemoryStorage();
  const key = trainingDraftKey("cloud", "student-a");
  writeTrainingDraft(storage, key, sampleDraft);
  assert.deepEqual(readTrainingDraft(storage, key), sampleDraft);
  storage.setItem(key, "not json");
  assert.equal(readTrainingDraft(storage, key), null);
});

test("同步第 1 組重量與單位但保留每組次數", () => {
  const original = sampleDraft.exercises[0];
  const result = copyFirstSetWeight(original);
  assert.deepEqual(result.sets, [
    { reps: "8", weight: "60", unit: "kg" },
    { reps: "10", weight: "60", unit: "kg" },
  ]);
  assert.equal(original.sets[1].weight, "");
});

test("第 1 組沒有重量時不覆蓋其他組", () => {
  const exercise = {
    name: "硬舉",
    sets: [
      { reps: "5", weight: "", unit: "kg" as const },
      { reps: "5", weight: "80", unit: "kg" as const },
    ],
  };
  assert.equal(copyFirstSetWeight(exercise), exercise);
});

test("正式儲存成功後才清除草稿", async () => {
  const storage = createMemoryStorage();
  const key = trainingDraftKey("cloud", "student-a");
  writeTrainingDraft(storage, key, sampleDraft);

  await assert.rejects(
    finalizeTrainingDraft(storage, key, async () => { throw new Error("save failed"); }),
    /save failed/,
  );
  assert.deepEqual(readTrainingDraft(storage, key), sampleDraft);

  const result = await finalizeTrainingDraft(storage, key, async () => ({ ok: true as const }));
  assert.deepEqual(result, { ok: true });
  assert.equal(readTrainingDraft(storage, key), null);
});
