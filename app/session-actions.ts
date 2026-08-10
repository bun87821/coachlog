"use server";

import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ExerciseInput = {
  name: string;
  sets: Array<{ reps: string; weight: string; unit: string }>;
};

const value = (entry: FormDataEntryValue | null) => String(entry || "").trim();

export async function updateSession(studentId: string, sessionId: string, formData: FormData) {
  const coach = await requireCoach();
  const exercises = JSON.parse(value(formData.get("exercisesJson"))) as ExerciseInput[];
  if (!exercises.length || exercises.some(exercise => !exercise.name.trim() || !exercise.sets.length)) {
    throw new Error("請至少保留一個動作與一組紀錄");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const session = await client.query(
      `UPDATE sessions s SET occurred_at=$4,notes=$5 FROM students st WHERE s.id=$1 AND s.student_id=$2 AND st.id=s.student_id AND st.coach_id=$3 RETURNING s.id`,
      [sessionId, studentId, coach.id, value(formData.get("date")), value(formData.get("notes")) || null],
    );
    if (!session.rows[0]) throw new Error("找不到這堂課");

    await client.query(`DELETE FROM exercise_sets WHERE session_id=$1`, [sessionId]);
    for (const exercise of exercises) {
      const savedExercise = await client.query(
        `INSERT INTO exercises(coach_id,name) VALUES($1,$2) ON CONFLICT(coach_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [coach.id, exercise.name.trim()],
      );
      for (let index = 0; index < exercise.sets.length; index++) {
        const set = exercise.sets[index];
        await client.query(
          `INSERT INTO exercise_sets(session_id,exercise_id,set_number,reps,weight,unit) VALUES($1,$2,$3,$4,$5,$6)`,
          [sessionId, savedExercise.rows[0].id, index + 1, set.reps ? Number(set.reps) : null, set.weight ? Number(set.weight) : null, set.unit === "lb" ? "lb" : "kg"],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}#history`);
}
