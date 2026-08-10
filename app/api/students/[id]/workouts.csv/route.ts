import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatTaipeiDateTime, stringifyCsv, workoutCsvHeaders } from "@/lib/csv";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const result = await db.query(`SELECT st.name student_name,s.id,COALESCE(s.import_key,s.id::text) session_key,s.occurred_at,s.notes,e.name exercise_name,es.set_number,es.reps,es.weight::text,es.unit FROM students st JOIN sessions s ON s.student_id=st.id JOIN exercise_sets es ON es.session_id=s.id JOIN exercises e ON e.id=es.exercise_id WHERE st.id=$1 AND st.coach_id=$2 ORDER BY s.occurred_at,e.name,es.set_number`, [id, session.user.id]);
  if (!result.rows.length) {
    const student = await db.query(`SELECT name FROM students WHERE id=$1 AND coach_id=$2`, [id, session.user.id]);
    if (!student.rows[0]) return new Response("Not found", { status: 404 });
    result.rows.push({ student_name: student.rows[0].name });
  }
  const dataRows = result.rows[0].session_key ? result.rows.map(row => [row.session_key, formatTaipeiDateTime(row.occurred_at), row.notes || "", row.exercise_name, row.set_number, row.reps ?? "", row.weight ?? "", row.unit]) : [];
  const filename = `coachlog-${String(result.rows[0].student_name).replace(/[^\p{L}\p{N}_-]+/gu, "-")}-workouts.csv`;
  return new Response(stringifyCsv([[...workoutCsvHeaders], ...dataRows]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } });
}
