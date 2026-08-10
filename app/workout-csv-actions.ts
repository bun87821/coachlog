"use server";

import { db } from "@/lib/db";
import { formatTaipeiDateTime, parseCsv, workoutCsvHeaders } from "@/lib/csv";
import { requireCoach } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type WorkoutRow = { key: string; occurredAt: string; notes: string; exercise: string; setNumber: number; reps: number | null; weight: number | null; unit: "kg" | "lb" };

const redirectResult = (studentId: string, values: Record<string, string | number>): never => {
  const params = new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]));
  redirect(`/students/${studentId}?${params.toString()}#csv-tools`);
};

export async function importWorkoutCsv(studentId: string, formData: FormData) {
  const coach = await requireCoach();
  const uploaded = formData.get("csv");
  if (uploaded === null || typeof uploaded === "string" || !uploaded.size) redirectResult(studentId, { csvError: "請選擇 CSV 檔案" });
  const file = uploaded as File;
  if (file.size > 2_000_000) redirectResult(studentId, { csvError: "CSV 檔案不可超過 2 MB" });

  let parsed: string[][];
  try { parsed = parseCsv(await file.text()); }
  catch (error) { redirectResult(studentId, { csvError: error instanceof Error ? error.message : "CSV 無法解析" }); }
  if (!parsed!.length) redirectResult(studentId, { csvError: "CSV 沒有資料" });
  if (parsed!.length > 5001) redirectResult(studentId, { csvError: "一次最多匯入 5,000 列" });
  if (workoutCsvHeaders.some((header, index) => parsed![0]?.[index]?.trim() !== header) || parsed![0].length !== workoutCsvHeaders.length) redirectResult(studentId, { csvError: `欄位必須依序為：${workoutCsvHeaders.join("、")}` });

  const rows: WorkoutRow[] = [];
  const errors: string[] = [];
  for (let index = 1; index < parsed!.length; index++) {
    const values = parsed![index];
    const line = index + 1;
    if (values.length !== workoutCsvHeaders.length) { errors.push(`第 ${line} 列欄位數量不正確`); continue; }
    const [key, dateTime, notes, exercise, setText, repsText, weightText, unitText] = values.map(value => value.trim());
    const setNumber = Number(setText); const reps = repsText === "" ? null : Number(repsText); const weight = weightText === "" ? null : Number(weightText); const unit = unitText.toLowerCase();
    if (!/^[\p{L}\p{N}_-]{1,100}$/u.test(key)) errors.push(`第 ${line} 列課堂識別碼格式不正確`);
    const occurredAt = new Date(`${dateTime.replace(" ", "T")}:00+08:00`);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateTime) || Number.isNaN(occurredAt.getTime()) || formatTaipeiDateTime(occurredAt) !== dateTime) errors.push(`第 ${line} 列上課時間格式不正確`);
    if (!exercise || exercise.length > 100) errors.push(`第 ${line} 列動作名稱不可空白且不可超過 100 字`);
    if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > 100) errors.push(`第 ${line} 列組次必須是 1–100 的整數`);
    if (reps !== null && (!Number.isInteger(reps) || reps < 0 || reps > 10000)) errors.push(`第 ${line} 列次數格式不正確`);
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 10000)) errors.push(`第 ${line} 列重量格式不正確`);
    if (unit !== "kg" && unit !== "lb") errors.push(`第 ${line} 列單位只能是 kg 或 lb`);
    if (!errors.some(error => error.startsWith(`第 ${line} 列`))) rows.push({ key, occurredAt: `${dateTime.replace(" ", "T")}:00+08:00`, notes, exercise, setNumber, reps, weight, unit: unit as "kg" | "lb" });
  }
  if (!rows.length && !errors.length) errors.push("CSV 沒有可匯入的訓練資料");
  if (errors.length) redirectResult(studentId, { csvError: `${errors.slice(0, 3).join("；")}${errors.length > 3 ? `；另有 ${errors.length - 3} 個錯誤` : ""}` });

  const sessionGroups = new Map<string, WorkoutRow[]>();
  for (const row of rows) (sessionGroups.get(row.key) || (sessionGroups.set(row.key, []), sessionGroups.get(row.key)!)).push(row);
  for (const [key, group] of sessionGroups) {
    if (group.some(row => row.occurredAt !== group[0].occurredAt || row.notes !== group[0].notes)) redirectResult(studentId, { csvError: `課堂 ${key} 的上課時間或備註不一致` });
    const setKeys = new Set<string>();
    for (const row of group) { const setKey = `${row.exercise}\u0000${row.setNumber}`; if (setKeys.has(setKey)) redirectResult(studentId, { csvError: `課堂 ${key} 的「${row.exercise}」第 ${row.setNumber} 組重複` }); setKeys.add(setKey); }
  }

  const student = await db.query(`SELECT id FROM students WHERE id=$1 AND coach_id=$2`, [studentId, coach.id]);
  if (!student.rows[0]) redirectResult(studentId, { csvError: "找不到學生" });

  const client = await db.connect();
  let imported = 0; let skipped = 0;
  try {
    await client.query("BEGIN");
    for (const [key, group] of sessionGroups) {
      const inserted = await client.query(`INSERT INTO sessions(student_id,occurred_at,notes,import_key) VALUES($1,$2,$3,$4) ON CONFLICT(student_id,import_key) WHERE import_key IS NOT NULL DO NOTHING RETURNING id`, [studentId, group[0].occurredAt, group[0].notes || null, key]);
      if (!inserted.rows[0]) { skipped++; continue; }
      for (const row of group) {
        const exercise = await client.query(`INSERT INTO exercises(coach_id,name) VALUES($1,$2) ON CONFLICT(coach_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [coach.id, row.exercise]);
        await client.query(`INSERT INTO exercise_sets(session_id,exercise_id,set_number,reps,weight,unit) VALUES($1,$2,$3,$4,$5,$6)`, [inserted.rows[0].id, exercise.rows[0].id, row.setNumber, row.reps, row.weight, row.unit]);
      }
      imported++;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("CSV import failed", error);
    redirectResult(studentId, { csvError: "匯入失敗，請確認格式後再試一次" });
  } finally { client.release(); }
  revalidatePath(`/students/${studentId}`);
  redirectResult(studentId, { csvImported: imported, csvSkipped: skipped });
}
