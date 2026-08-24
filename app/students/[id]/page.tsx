import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { Header } from "@/components/Header";
import { addMetric } from "@/app/actions";
import { ProgressCharts } from "@/components/ProgressCharts";
import { TrainingSessionForm } from "@/components/TrainingSessionForm";
import { WorkoutCsvTools } from "@/components/WorkoutCsvTools";
import { SessionParticipants } from "@/components/SessionParticipants";
import { StudentSectionNav } from "@/components/StudentSectionNav";
import { trainingInputMode } from "@/lib/training-form-state";
import { selectOnFocus } from "@/lib/number-input";

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ csvImported?: string; csvSkipped?: string; csvError?: string; with?: string; at?: string }> }) {
  const { id } = await params;
  const csvResult = await searchParams;
  const user = await requireCoach();
  const bookedAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(csvResult.at || "") ? csvResult.at : undefined;
  const requestedPartners = (csvResult.with || "").split(",").map(value => value.trim()).filter(Boolean).filter(value => value !== id);
  const [student, metrics, exercises, loads, sessionRows, coachStudents, groupPartners] = await Promise.all([
    db.query(`SELECT * FROM students WHERE id=$1 AND coach_id=$2`, [id, user.id]),
    db.query(`SELECT measured_at::text date,weight::float,"body_fat"::float "bodyFat",muscle_mass::float muscle,fat_mass::float "fatMass" FROM body_metrics WHERE student_id=$1 ORDER BY measured_at`, [id]),
    db.query(`SELECT name FROM exercises WHERE coach_id=$1 ORDER BY name`, [user.id]),
    db.query(`SELECT e.name, s.occurred_at::date::text date, MAX(CASE WHEN es.unit='lb' THEN es.weight*0.453592 ELSE es.weight END)::float weight FROM sessions s JOIN exercise_sets es ON es.session_id=s.id JOIN exercises e ON e.id=es.exercise_id WHERE s.student_id=$1 GROUP BY e.name,s.occurred_at::date ORDER BY s.occurred_at::date`, [id]),
    db.query(`SELECT s.id,s.occurred_at,s.notes,s.group_id,e.name exercise_name,es.set_number,es.reps,es.weight::float,es.unit FROM sessions s LEFT JOIN exercise_sets es ON es.session_id=s.id LEFT JOIN exercises e ON e.id=es.exercise_id WHERE s.student_id=$1 ORDER BY s.occurred_at DESC,e.name,es.set_number`, [id]),
    db.query(`SELECT id,name FROM students WHERE coach_id=$1 AND id<>$2 ORDER BY sort_order ASC NULLS LAST,created_at DESC,id`, [user.id, id]),
    db.query(`SELECT partner.group_id,st.id,st.name FROM sessions partner JOIN students st ON st.id=partner.student_id WHERE partner.student_id<>$1 AND partner.group_id IN (SELECT group_id FROM sessions WHERE student_id=$1 AND group_id IS NOT NULL)`, [id]),
  ]);
  if (!student.rows[0]) notFound();
  const currentStudent = student.rows[0];
  const sessions = sessionRows.rows.reduce((all: any[], row: any) => {
    let session = all.find(item => item.id === row.id);
    if (!session) { session = { id: row.id, occurredAt: row.occurred_at, notes: row.notes, groupId: row.group_id, exercises: [] }; all.push(session); }
    if (row.exercise_name) {
      let exercise = session.exercises.find((item: any) => item.name === row.exercise_name);
      if (!exercise) { exercise = { name: row.exercise_name, sets: [] }; session.exercises.push(exercise); }
      exercise.sets.push({ setNumber: row.set_number, reps: row.reps, weight: row.weight, unit: row.unit });
    }
    return all;
  }, []);
  const metricAction = addMetric.bind(null, id);
  const candidates = coachStudents.rows.map((row: any) => ({ id: String(row.id), name: row.name as string }));
  const partners = requestedPartners.map(partnerId => candidates.find(candidate => candidate.id === partnerId)).filter(Boolean) as Array<{ id: string; name: string }>;
  const participants = [{ id, name: currentStudent.name as string }, ...partners];
  const partnersByGroup = groupPartners.rows.reduce((all: Record<string, string[]>, row: any) => {
    (all[row.group_id] ||= []).push(row.name);
    return all;
  }, {});

  return <main className="shell">
    <Header name={user.name} />
    <StudentSectionNav trailing={<a href="/dashboard#calendar">學生預約</a>} />
    <a className="muted" href="/dashboard">← 返回學生列表</a>
    <div className="section-title student-heading" id="student-overview"><div><div className="eyebrow">學生紀錄</div><h1>{currentStudent.name}</h1><div className="muted">{currentStudent.email} {currentStudent.phone}</div></div><a className="button mobile-quick-add" href="#new-workout">＋ 新增訓練</a></div>
    <section className="progress-section" id="progress"><div className="section-title"><div><div className="eyebrow">進步趨勢</div><h2>數據曲線</h2></div></div><ProgressCharts metrics={metrics.rows} loads={loads.rows} /></section>
    <div className="record-layout">
      <section className="record-section" id="new-workout"><div className="section-title"><div><div className="eyebrow">新增紀錄</div><h2>本次訓練內容</h2></div></div><div className="card"><SessionParticipants student={{ id, name: currentStudent.name }} partners={partners} candidates={candidates} /><TrainingSessionForm participants={participants} initialDate={bookedAt} exerciseNames={exercises.rows.map(row => row.name)} lastSession={sessions[0] && participants.length === 1 ? { occurredAt: sessions[0].occurredAt.toISOString?.() || String(sessions[0].occurredAt), exercises: sessions[0].exercises } : undefined} /></div></section>
      <section className="record-section" id="body-metrics"><div className="section-title"><div><div className="eyebrow">身體數據</div><h2>新增身體數據</h2></div></div><div className="card"><form className="stack" action={metricAction}><label>測量日期<input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required /></label><div className="row"><label>體重 kg<input name="weight" {...selectOnFocus} type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label><label>體脂 %<input name="bodyFat" {...selectOnFocus} type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label></div><div className="row"><label>肌肉量 kg<input name="muscle" {...selectOnFocus} type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label><label>脂肪重量 kg<input name="fatMass" {...selectOnFocus} type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label></div><button>儲存身體數據</button></form></div></section>
    </div>
    <section className="history-section" id="history"><div className="section-title"><div><div className="eyebrow">課程歷史</div><h2>過去訓練紀錄</h2></div><span className="muted">共 {sessions.length} 堂</span></div>
      {sessions.length ? <div className="session-history">{sessions.map((session: any, index: number) => <article className="card session-card" key={session.id}><div className="session-date"><div>{index === 0 && <span className="latest-badge">最新紀錄</span>}<strong>{new Date(session.occurredAt).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })}</strong></div><time>{new Date(session.occurredAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} · {session.exercises.length} 個動作 · {session.exercises.reduce((total: number, exercise: any) => total + exercise.sets.length, 0)} 組</time>{session.groupId && partnersByGroup[session.groupId]?.length ? <span className="partner-badge">與 {partnersByGroup[session.groupId].join("、")} 一起上課</span> : null}</div>{session.notes && <p className="session-note">{session.notes}</p>}<div className="history-exercises">{session.exercises.map((exercise: any) => <div className="history-exercise" key={exercise.name}><h3>{exercise.name}</h3><div className="history-sets">{exercise.sets.map((set: any) => <span key={set.setNumber}>第 {set.setNumber} 組　<strong>{set.weight ?? "—"} {set.unit}</strong> × {set.reps ?? "—"}</span>)}</div></div>)}</div><details className="session-editor"><summary>修改這堂課</summary><TrainingSessionForm participants={[{ id, name: currentStudent.name }]} exerciseNames={exercises.rows.map(row => row.name)} session={{ id: session.id, occurredAt: session.occurredAt.toISOString?.() || String(session.occurredAt), notes: session.notes, exercises: session.exercises }} /></details></article>)}</div> : <div className="card empty">尚無訓練紀錄，完成上方表單後會顯示在這裡。</div>}
    </section>
    <WorkoutCsvTools studentId={id} imported={csvResult.csvImported} skipped={csvResult.csvSkipped} error={csvResult.csvError} />
  </main>;
}
