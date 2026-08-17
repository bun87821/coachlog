import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { Header } from "@/components/Header";
import { addMetric } from "@/app/actions";
import { ProgressCharts } from "@/components/ProgressCharts";
import { TrainingSessionForm } from "@/components/TrainingSessionForm";
import { RestTimer } from "@/components/RestTimer";
import { WorkoutCsvTools } from "@/components/WorkoutCsvTools";
import { trainingInputMode } from "@/lib/training-form-state";

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ csvImported?: string; csvSkipped?: string; csvError?: string }> }) {
  const { id } = await params;
  const csvResult = await searchParams;
  const user = await requireCoach();
  const [student, metrics, exercises, loads, sessionRows] = await Promise.all([
    db.query(`SELECT * FROM students WHERE id=$1 AND coach_id=$2`, [id, user.id]),
    db.query(`SELECT measured_at::text date,weight::float,"body_fat"::float "bodyFat",muscle_mass::float muscle,fat_mass::float "fatMass" FROM body_metrics WHERE student_id=$1 ORDER BY measured_at`, [id]),
    db.query(`SELECT name FROM exercises WHERE coach_id=$1 ORDER BY name`, [user.id]),
    db.query(`SELECT e.name, s.occurred_at::date::text date, MAX(CASE WHEN es.unit='lb' THEN es.weight*0.453592 ELSE es.weight END)::float weight FROM sessions s JOIN exercise_sets es ON es.session_id=s.id JOIN exercises e ON e.id=es.exercise_id WHERE s.student_id=$1 GROUP BY e.name,s.occurred_at::date ORDER BY s.occurred_at::date`, [id]),
    db.query(`SELECT s.id,s.occurred_at,s.notes,e.name exercise_name,es.set_number,es.reps,es.weight::float,es.unit FROM sessions s LEFT JOIN exercise_sets es ON es.session_id=s.id LEFT JOIN exercises e ON e.id=es.exercise_id WHERE s.student_id=$1 ORDER BY s.occurred_at DESC,e.name,es.set_number`, [id]),
  ]);
  if (!student.rows[0]) notFound();
  const currentStudent = student.rows[0];
  const sessions = sessionRows.rows.reduce((all: any[], row: any) => {
    let session = all.find(item => item.id === row.id);
    if (!session) { session = { id: row.id, occurredAt: row.occurred_at, notes: row.notes, exercises: [] }; all.push(session); }
    if (row.exercise_name) {
      let exercise = session.exercises.find((item: any) => item.name === row.exercise_name);
      if (!exercise) { exercise = { name: row.exercise_name, sets: [] }; session.exercises.push(exercise); }
      exercise.sets.push({ setNumber: row.set_number, reps: row.reps, weight: row.weight, unit: row.unit });
    }
    return all;
  }, []);
  const metricAction = addMetric.bind(null, id);

  return <main className="shell">
    <Header name={user.name} />
    <aside className="student-quick-nav" aria-label="學生頁快速導覽"><strong>快速前往</strong><nav><a href="#student-overview">學生資料</a><a href="#progress">進步趨勢</a><a href="#new-workout">新增訓練</a><a href="#body-metrics">身體數據</a><a href="#history">歷史紀錄</a><a href="/dashboard#calendar">學生預約</a></nav></aside>
    <a className="muted" href="/dashboard">← 返回學生列表</a>
    <div className="section-title student-heading" id="student-overview"><div><div className="eyebrow">學生紀錄</div><h1>{currentStudent.name}</h1><div className="muted">{currentStudent.email} {currentStudent.phone}</div></div><a className="button mobile-quick-add" href="#new-workout">＋ 新增訓練</a></div>
    <section className="progress-section" id="progress"><div className="section-title"><div><div className="eyebrow">進步趨勢</div><h2>數據曲線</h2></div></div><ProgressCharts metrics={metrics.rows} loads={loads.rows} /></section>
    <div className="record-layout">
      <div className="card" id="new-workout"><div className="form-heading"><div><div className="eyebrow">新增紀錄</div><h2>本次訓練內容</h2></div></div><RestTimer /><TrainingSessionForm studentId={id} exerciseNames={exercises.rows.map(row => row.name)} lastSession={sessions[0] ? { occurredAt: sessions[0].occurredAt.toISOString?.() || String(sessions[0].occurredAt), exercises: sessions[0].exercises } : undefined} /></div>
      <div className="card" id="body-metrics"><h2>新增身體數據</h2><form className="stack" action={metricAction}><label>測量日期<input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required /></label><div className="row"><label>體重 kg<input name="weight" type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label><label>體脂 %<input name="bodyFat" type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label></div><div className="row"><label>肌肉量 kg<input name="muscle" type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label><label>脂肪重量 kg<input name="fatMass" type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label></div><button>儲存身體數據</button></form></div>
    </div>
    <section className="history-section" id="history"><div className="section-title"><div><div className="eyebrow">課程歷史</div><h2>過去訓練紀錄</h2></div><span className="muted">共 {sessions.length} 堂</span></div>
      {sessions.length ? <div className="session-history">{sessions.map((session: any, index: number) => <article className="card session-card" key={session.id}><div className="session-date"><div>{index === 0 && <span className="latest-badge">最新紀錄</span>}<strong>{new Date(session.occurredAt).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })}</strong></div><time>{new Date(session.occurredAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} · {session.exercises.length} 個動作 · {session.exercises.reduce((total: number, exercise: any) => total + exercise.sets.length, 0)} 組</time></div>{session.notes && <p className="session-note">{session.notes}</p>}<div className="history-exercises">{session.exercises.map((exercise: any) => <div className="history-exercise" key={exercise.name}><h3>{exercise.name}</h3><div className="history-sets">{exercise.sets.map((set: any) => <span key={set.setNumber}>第 {set.setNumber} 組　<strong>{set.weight ?? "—"} {set.unit}</strong> × {set.reps ?? "—"}</span>)}</div></div>)}</div><details className="session-editor"><summary>修改這堂課</summary><TrainingSessionForm studentId={id} exerciseNames={exercises.rows.map(row => row.name)} session={{ id: session.id, occurredAt: session.occurredAt.toISOString?.() || String(session.occurredAt), notes: session.notes, exercises: session.exercises }} /></details></article>)}</div> : <div className="card empty">尚無訓練紀錄，完成上方表單後會顯示在這裡。</div>}
    </section>
    <WorkoutCsvTools studentId={id} imported={csvResult.csvImported} skipped={csvResult.csvSkipped} error={csvResult.csvError} />
  </main>;
}
