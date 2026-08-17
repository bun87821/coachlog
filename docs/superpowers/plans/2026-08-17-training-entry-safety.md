# Training Entry Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓登入版與本機版都能保存未送出的訓練草稿、同步第 1 組重量、叫出正確手機數字鍵盤，並記錄 InBody 脂肪重量。

**Architecture:** 將草稿儲存、成功後清除及重量同步抽成可測試的純 TypeScript 模組，兩個 React 表單共用相同行為。雲端脂肪重量透過既有 migration 與 Server Action 寫入 PostgreSQL，本機資料以可選欄位維持 localStorage 向下相容；PWA 統一由 `/` 啟動。

**Tech Stack:** Next.js 16 App Router、React 19、NextAuth 5、PostgreSQL、Node.js 22 built-in test runner、TypeScript。

## Global Constraints

- 草稿只保存在同一台裝置，不上傳資料庫、不跨裝置同步。
- 正式儲存成功後才清除草稿；儲存失敗時保留。
- 脂肪重量由教練輸入 InBody 原始 kg 數值，不自動推算。
- 不自動合併或上傳本機資料。
- 登入版與本機版使用一致的繁體中文 UI 與行為。

---

### Task 1: 共用草稿與重量同步邏輯

**Files:**
- Create: `lib/training-form-state.ts`
- Create: `tests/training-form-state.test.ts`

**Interfaces:**
- Produces: `trainingDraftKey(scope, studentId)`、`readTrainingDraft(storage, key)`、`writeTrainingDraft(storage, key, draft)`、`finalizeTrainingDraft(storage, key, save)`、`copyFirstSetWeight(exercise)`。
- Produces types: `TrainingSetRow`、`TrainingExerciseRow`、`TrainingDraft`、`DraftStorage`。

- [ ] **Step 1: 寫入失敗測試**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  copyFirstSetWeight,
  finalizeTrainingDraft,
  readTrainingDraft,
  trainingDraftKey,
  writeTrainingDraft,
} from "../lib/training-form-state.ts";

test("草稿鍵值依模式與學生隔離", () => {
  assert.notEqual(trainingDraftKey("cloud", "a"), trainingDraftKey("local", "a"));
  assert.notEqual(trainingDraftKey("cloud", "a"), trainingDraftKey("cloud", "b"));
});

test("同步第 1 組重量與單位但保留次數", () => {
  const result = copyFirstSetWeight({ name: "深蹲", sets: [
    { reps: "8", weight: "60", unit: "kg" },
    { reps: "10", weight: "", unit: "lb" },
  ] });
  assert.deepEqual(result.sets[1], { reps: "10", weight: "60", unit: "kg" });
});

test("成功送出才清除草稿，失敗時保留", async () => {
  const storage = createMemoryStorage();
  const key = trainingDraftKey("cloud", "a");
  writeTrainingDraft(storage, key, sampleDraft);
  await assert.rejects(() => finalizeTrainingDraft(storage, key, async () => { throw new Error("save failed"); }));
  assert.ok(readTrainingDraft(storage, key));
  await finalizeTrainingDraft(storage, key, async () => ({ ok: true }));
  assert.equal(readTrainingDraft(storage, key), null);
});
```

- [ ] **Step 2: 確認測試因模組尚未存在而失敗**

Run: `node --experimental-strip-types --test tests/training-form-state.test.ts`

Expected: FAIL，指出找不到 `lib/training-form-state.ts`。

- [ ] **Step 3: 實作共用純函式**

```ts
export type TrainingSetRow = { reps: string; weight: string; unit: "kg" | "lb" };
export type TrainingExerciseRow = { name: string; sets: TrainingSetRow[] };
export type TrainingDraft = { date: string; notes: string; exercises: TrainingExerciseRow[] };
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const trainingDraftKey = (scope: "cloud" | "local", studentId: string) =>
  `coachlog-training-draft-v1:${scope}:${studentId}`;

export function copyFirstSetWeight(exercise: TrainingExerciseRow): TrainingExerciseRow {
  const first = exercise.sets[0];
  if (!first?.weight) return exercise;
  return { ...exercise, sets: exercise.sets.map((set, index) => index === 0 ? set : { ...set, weight: first.weight, unit: first.unit }) };
}

export async function finalizeTrainingDraft<T>(storage: DraftStorage, key: string, save: () => Promise<T>) {
  const result = await save();
  storage.removeItem(key);
  return result;
}
```

`readTrainingDraft` 解析失敗時回傳 `null`；`writeTrainingDraft` 以 JSON 寫入完整 `TrainingDraft`。

- [ ] **Step 4: 確認共用邏輯測試通過**

Run: `node --experimental-strip-types --test tests/training-form-state.test.ts`

Expected: 0 failures。

- [ ] **Step 5: 提交共用邏輯**

```bash
git add lib/training-form-state.ts tests/training-form-state.test.ts
git commit -m "Add training draft state helpers"
```

### Task 2: 登入版草稿、重量同步與數字鍵盤

**Files:**
- Modify: `components/TrainingSessionForm.tsx`
- Modify: `app/actions.ts`
- Create: `scripts/check-training-entry.mjs`

**Interfaces:**
- Consumes: Task 1 的 `TrainingDraft`、草稿存取、`finalizeTrainingDraft` 與 `copyFirstSetWeight`。
- Produces: 新增訓練的同裝置草稿；`addSession(studentId, formData)` 成功回傳 `{ ok: true }`，不再由 Server Action redirect。

- [ ] **Step 1: 寫入登入版失敗檢查**

```js
const cloudForm = fs.readFileSync(new URL("../components/TrainingSessionForm.tsx", import.meta.url), "utf8");
const checks = [
  [cloudForm.includes("trainingDraftKey") && cloudForm.includes("finalizeTrainingDraft"), "登入版必須保存並在成功後清除草稿"],
  [cloudForm.includes("套用第 1 組重量"), "登入版必須提供重量同步"],
  [cloudForm.includes('inputMode="numeric"'), "次數必須使用整數鍵盤"],
  [cloudForm.includes('inputMode="decimal"'), "重量必須使用小數鍵盤"],
];
```

- [ ] **Step 2: 確認檢查因功能尚未加入而失敗**

Run: `node scripts/check-training-entry.mjs`

Expected: FAIL，列出登入版草稿、同步按鈕與 inputMode 缺少。

- [ ] **Step 3: 將新增訓練改為成功回傳**

`app/actions.ts` 的 `addSession` 保留 transaction 與 `revalidatePath`，移除最後的 `redirect`，成功時回傳：

```ts
return { ok: true as const };
```

編輯既有課堂仍使用 `updateSession` 原有流程。

- [ ] **Step 4: 接入登入版草稿與恢復提示**

`TrainingSessionForm` 將新增表單的日期、備註與 exercises 納入 `TrainingDraft` state；初次 mount 讀取 `localStorage`，完成讀取後的每次變更自動寫入。成功送出使用：

```ts
await finalizeTrainingDraft(window.localStorage, draftKey, () => addSession(studentId, formData));
setExercises([newExercise()]);
setDate("");
setNotes("");
router.refresh();
```

失敗時顯示「儲存失敗，草稿仍保留」，並且不清除 localStorage。只有新增表單啟用草稿，session 編輯表單維持原樣。

- [ ] **Step 5: 加入重量同步與鍵盤設定**

```tsx
<button type="button" disabled={!exercise.sets[0]?.weight || exercise.sets.length === 1}
  onClick={() => updateExercise(exerciseIndex, copyFirstSetWeight(exercise))}>
  套用第 1 組重量
</button>
```

次數 input 加入 `inputMode="numeric"`；重量 input 加入 `inputMode="decimal"`。

- [ ] **Step 6: 確認登入版檢查與共用測試通過**

Run: `node scripts/check-training-entry.mjs && node --experimental-strip-types --test tests/training-form-state.test.ts`

Expected: 0 failures。

- [ ] **Step 7: 提交登入版功能**

```bash
git add app/actions.ts components/TrainingSessionForm.tsx scripts/check-training-entry.mjs
git commit -m "Preserve cloud training drafts"
```

### Task 3: 本機版草稿、重量同步與數字鍵盤

**Files:**
- Modify: `components/LocalStudentPage.tsx`
- Modify: `components/LocalCoachApp.tsx`
- Modify: `scripts/check-training-entry.mjs`

**Interfaces:**
- Consumes: Task 1 的共用 helpers，scope 使用 `local`。
- Produces: 本機學生頁的同裝置草稿，成功寫入 `LocalCoachData` 後清除。

- [ ] **Step 1: 擴充失敗檢查**

要求 `LocalStudentPage.tsx` 包含 `trainingDraftKey("local", student.id)`、`套用第 1 組重量`、`inputMode="numeric"` 與 `inputMode="decimal"`。

- [ ] **Step 2: 確認本機版檢查失敗**

Run: `node scripts/check-training-entry.mjs`

Expected: FAIL，指出本機草稿、同步按鈕與鍵盤設定缺少。

- [ ] **Step 3: 實作本機草稿**

將 `LocalStudentPage` 的日期、備註與 exercises 納入同一份 `TrainingDraft`。mount 時恢復，變更時保存；`saveSession` 成功呼叫 `update` 後清除 key、重設表單並顯示成功狀態。

- [ ] **Step 4: 加入本機重量同步與鍵盤設定**

本機表單使用與 Task 2 相同按鈕條件及 `copyFirstSetWeight`。次數使用 `inputMode="numeric"`，重量使用 `inputMode="decimal"`。

- [ ] **Step 5: 移除未使用的重複學生表單**

刪除 `LocalCoachApp.tsx` 底部未被呼叫的 `Student` 函式及其專用 imports，保留實際使用的 `LocalStudentPage`，避免兩套本機表單行為分歧。

- [ ] **Step 6: 確認本機檢查與共用測試通過**

Run: `node scripts/check-training-entry.mjs && node --experimental-strip-types --test tests/training-form-state.test.ts`

Expected: 0 failures。

- [ ] **Step 7: 提交本機版功能**

```bash
git add components/LocalStudentPage.tsx components/LocalCoachApp.tsx scripts/check-training-entry.mjs
git commit -m "Preserve local training drafts"
```

### Task 4: 脂肪重量資料流程

**Files:**
- Modify: `scripts/migrate.mjs`
- Modify: `app/actions.ts`
- Modify: `app/students/[id]/page.tsx`
- Modify: `lib/local-coach-data.ts`
- Modify: `components/LocalStudentPage.tsx`
- Modify: `components/ProgressCharts.tsx`
- Modify: `scripts/check-training-entry.mjs`

**Interfaces:**
- Produces database column: `body_metrics.fat_mass numeric NULL`。
- Produces UI field and chart key: `fatMass`。

- [ ] **Step 1: 擴充脂肪重量失敗檢查**

檢查 migration 包含 `ADD COLUMN IF NOT EXISTS fat_mass numeric`、Server Action 讀取 `fd.get("fatMass")`、雲端 query alias `"fatMass"`、本機 type `fatMass?:string`、兩個表單的「脂肪重量 kg」以及圖表的 `dataKey="fatMass"`。

- [ ] **Step 2: 確認脂肪重量檢查失敗**

Run: `node scripts/check-training-entry.mjs`

Expected: FAIL，列出尚未完成的資料庫、表單、本機資料與圖表層。

- [ ] **Step 3: 新增可重複執行的資料庫遷移與寫入**

```sql
ALTER TABLE body_metrics ADD COLUMN IF NOT EXISTS fat_mass numeric;
```

`addMetric` 的 INSERT 增加 `fat_mass` 與 `num(fd.get("fatMass"))`。

- [ ] **Step 4: 串接雲端查詢與表單**

學生頁 SELECT 增加 `fat_mass::float "fatMass"`；表單增加：

```tsx
<label>脂肪重量 kg<input name="fatMass" type="number" min="0" step="0.1" inputMode="decimal" /></label>
```

其餘體重、體脂率與肌肉量 inputs 同步加入 `min="0"` 與 `inputMode="decimal"`。

- [ ] **Step 5: 串接本機資料與圖表**

`LocalMetric` 加入 `fatMass?:string`；儲存表單讀取 `fatMass`；映射給 `ProgressCharts` 時轉成 number 或 null。圖表新增：

```tsx
<Line type="monotone" dataKey="fatMass" name="脂肪重量 kg" stroke="#9b5bb5" />
```

- [ ] **Step 6: 確認脂肪重量與所有輸入檢查通過**

Run: `node scripts/check-training-entry.mjs && node --experimental-strip-types --test tests/training-form-state.test.ts`

Expected: 0 failures。

- [ ] **Step 7: 提交脂肪重量功能**

```bash
git add scripts/migrate.mjs app/actions.ts app/students/[id]/page.tsx lib/local-coach-data.ts components/LocalStudentPage.tsx components/ProgressCharts.tsx scripts/check-training-entry.mjs
git commit -m "Add InBody fat mass tracking"
```

### Task 5: PWA 導覽與完整驗證

**Files:**
- Modify: `app/manifest.ts`
- Modify: `components/LocalCoachApp.tsx`
- Modify: `scripts/check-pwa-navigation.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: PWA `start_url: "/"`，本機模式登入入口，以及單一 `npm test` 驗證入口。

- [ ] **Step 1: 確認既有 PWA 修正符合規格**

Run: `node scripts/check-pwa-navigation.mjs`

Expected: PASS，確認 manifest 從 `/` 啟動且本機模式含 Google 登入入口。

- [ ] **Step 2: 加入統一測試指令**

`package.json` scripts 增加：

```json
"test": "node --experimental-strip-types --test tests/*.test.ts && node scripts/check-training-entry.mjs && node scripts/check-pwa-navigation.mjs"
```

- [ ] **Step 3: 執行完整測試、型別與 production build**

Run: `npm test`

Expected: 0 failures。

Run: `npx tsc --noEmit`

Expected: exit 0。

Run: `npm run build`

Expected: Next.js production build exit 0。

- [ ] **Step 4: 檢查差異與敏感資料**

Run: `git diff --check && git status --short --untracked-files=no`

Expected: 僅包含本計畫列出的程式、測試與文件，沒有 `.env` 或憑證。

- [ ] **Step 5: 提交 PWA 與測試入口**

```bash
git add app/manifest.ts components/LocalCoachApp.tsx scripts/check-pwa-navigation.mjs package.json
git commit -m "Complete PWA training entry safeguards"
```

- [ ] **Step 6: 推送並確認遠端同步**

Run: `git push origin main`

Run: `git rev-parse HEAD && git rev-parse origin/main`

Expected: 兩個 SHA 相同。
