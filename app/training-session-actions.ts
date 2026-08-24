"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { revalidatePath } from "next/cache";

type SessionInput = {
  studentId: string;
  notes: string;
  exercises: Array<{ name: string; sets: Array<{ reps: string; weight: string; unit: string }> }>;
};

const value = (entry: FormDataEntryValue | null) => String(entry || "").trim();

export async function addGroupSession(formData: FormData) {
  const coach = await requireCoach();
  const sessions = JSON.parse(value(formData.get("sessionsJson"))) as SessionInput[];
  if (!Array.isArray(sessions) || !sessions.length) throw new Error("請至少填寫一位學生的訓練內容");
  if (sessions.some(session => !session.exercises.length || session.exercises.some(exercise => !exercise.name.trim() || !exercise.sets.length))) {
    throw new Error("請至少填寫一個動作與一組紀錄");
  }

  const studentIds = sessions.map(session => session.studentId);
  if (new Set(studentIds).size !== studentIds.length) throw new Error("同一位學生不可重複");
  const students = await db.query(`SELECT id FROM students WHERE id = ANY($1::uuid[]) AND coach_id=$2`, [studentIds, coach.id]);
  if (students.rows.length !== studentIds.length) throw new Error("找不到學生");

  const occurredAt = value(formData.get("date"));
  const groupId = sessions.length > 1 ? randomUUID() : null;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const session of sessions) {
      const created = await client.query(
        `INSERT INTO sessions(student_id,occurred_at,notes,group_id) VALUES($1,$2,$3,$4) RETURNING id`,
        [session.studentId, occurredAt, session.notes.trim() || null, groupId],
      );
      for (const exercise of session.exercises) {
        const savedExercise = await client.query(
          `INSERT INTO exercises(coach_id,name) VALUES($1,$2) ON CONFLICT(coach_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [coach.id, exercise.name.trim()],
        );
        for (let index = 0; index < exercise.sets.length; index++) {
          const set = exercise.sets[index];
          await client.query(
            `INSERT INTO exercise_sets(session_id,exercise_id,set_number,reps,weight,unit) VALUES($1,$2,$3,$4,$5,$6)`,
            [created.rows[0].id, savedExercise.rows[0].id, index + 1, set.reps ? Number(set.reps) : null, set.weight ? Number(set.weight) : null, set.unit === "lb" ? "lb" : "kg"],
          );
        }
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  for (const studentId of studentIds) revalidatePath(`/students/${studentId}`);
  return { ok: true as const, saved: sessions.length };
}
