"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressCharts } from "@/components/ProgressCharts";
import { RestTimer } from "@/components/RestTimer";
import { uid, type LocalCoachData, type LocalExercise, type LocalStudent } from "@/lib/local-coach-data";
import {
  canCopyFirstSetWeight,
  copyFirstSetWeight,
  finalizeTrainingDraft,
  readTrainingDraft,
  trainingDraftKey,
  trainingInputMode,
  writeTrainingDraft,
} from "@/lib/training-form-state";
import "./WorkoutCsvTools.css";

const today = () => new Date().toISOString().slice(0, 10);
const blankExercise = (): LocalExercise => ({ name: "", sets: Array.from({ length: 4 }, () => ({ reps: "10", weight: "", unit: "kg" })) });

export function LocalStudentPage({ data, studentId, update, back }: { data: LocalCoachData; studentId: string; update: (data: LocalCoachData) => void; back: () => void }) {
  const student = data.students.find(item => item.id === studentId)!;
  const [exercises, setExercises] = useState<LocalExercise[]>([blankExercise()]);
  const [date, setDate] = useState(`${today()}T09:00`);
  const [notes, setNotes] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const skipNextAutosave = useRef(false);
  const draftKey = trainingDraftKey("local", student.id);
  const replace = (next: LocalStudent) => update({ ...data, students: data.students.map(item => item.id === student.id ? next : item) });
  const loads = student.sessions.flatMap(session => session.exercises.map(exercise => ({ name: exercise.name, date: session.date.slice(0, 10), weight: Math.max(...exercise.sets.map(set => (Number(set.weight) || 0) * (set.unit === "lb" ? .453592 : 1))) })));

  useEffect(() => {
    const draft = readTrainingDraft(window.localStorage, draftKey);
    if (draft) {
      setDate(draft.date);
      setNotes(draft.notes);
      setExercises(draft.exercises);
      setDraftRestored(true);
    }
    setDraftReady(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    writeTrainingDraft(window.localStorage, draftKey, { date, notes, exercises });
  }, [date, draftKey, draftReady, exercises, notes]);

  const updateExercise = (exerciseIndex: number, patch: Partial<LocalExercise>) => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? { ...row, ...patch } : row));
  const saveSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = exercises.filter(exercise => exercise.name.trim());
    if (!clean.length) return;
    const exerciseNames = [...new Set([...data.exerciseNames, ...clean.map(exercise => exercise.name.trim())])].sort();
    const next = {
      ...data,
      exerciseNames,
      students: data.students.map(item => item.id === student.id ? {
        ...student,
        sessions: [{ id: uid(), date, notes, exercises: clean }, ...student.sessions],
      } : item),
    };
    try {
      await finalizeTrainingDraft(window.localStorage, draftKey, async () => update(next));
      skipNextAutosave.current = true;
      setExercises([blankExercise()]);
      setDate(`${today()}T09:00`);
      setNotes("");
      setDraftRestored(false);
      setSaveMessage("本次訓練已儲存。");
    } catch {
      setSaveMessage("儲存失敗，草稿仍保留，請稍後再試。");
    }
  };

  return <main className="shell local-app">
    <nav className="topbar"><button className="brand local-brand-button" onClick={back}>Coach<span>Log</span></button><span className="local-badge">本機模式</span></nav>
    <aside className="student-quick-nav" aria-label="學生頁快速導覽"><strong>快速前往</strong><nav><a href="#student-overview">學生資料</a><a href="#progress">進步趨勢</a><a href="#new-workout">新增訓練</a><a href="#body-metrics">身體數據</a><a href="#history">歷史紀錄</a><button type="button" onClick={back}>學生預約</button></nav></aside>
    <button className="muted local-back-link" onClick={back}>← 返回學生列表</button>
    <div className="section-title student-heading" id="student-overview"><div><div className="eyebrow">學生紀錄</div><h1>{student.name}</h1><div className="muted">{student.email} {student.phone}</div></div><a className="button mobile-quick-add" href="#new-workout">＋ 新增訓練</a></div>
    <section className="progress-section" id="progress"><div className="section-title"><div><div className="eyebrow">進步趨勢</div><h2>數據曲線</h2></div></div><ProgressCharts metrics={student.metrics.map(metric => ({ date: metric.date, weight: Number(metric.weight) || null, bodyFat: Number(metric.bodyFat) || null, muscle: Number(metric.muscle) || null, fatMass: Number(metric.fatMass) || null }))} loads={loads} /></section>
    <div className="record-layout">
      <div className="card" id="new-workout">
        <div className="form-heading"><div><div className="eyebrow">新增紀錄</div><h2>本次訓練內容</h2></div></div>
        <RestTimer />
        {student.sessions[0] && <button className="copy-workout" type="button" onClick={() => setExercises(structuredClone(student.sessions[0].exercises))}><span>⧉</span><span><strong>複製上次菜單</strong><small>複製後可自由調整重量與次數</small></span></button>}
        <p className="copy-status" aria-live="polite">{draftRestored ? "已恢復尚未儲存的訓練草稿。" : saveMessage}</p>
        <form className="stack" onSubmit={saveSession}>
          <label>上課時間<input name="date" type="datetime-local" value={date} onChange={event => setDate(event.target.value)} required /></label>
          <textarea name="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="本次課程備註、學生狀態或下次調整方向" />
          <datalist id="local-exercise-list">{data.exerciseNames.map(name => <option key={name}>{name}</option>)}</datalist>
          <div className="exercise-editor">{exercises.map((exercise, exerciseIndex) => <div className="exercise-block" key={exerciseIndex}>
            <div className="exercise-title-row"><div className="exercise-name-fields"><label>動作 {exerciseIndex + 1}<select value={data.exerciseNames.includes(exercise.name) ? exercise.name : ""} onChange={event => updateExercise(exerciseIndex, { name: event.target.value })}><option value="">選擇既有動作</option>{data.exerciseNames.map(name => <option key={name}>{name}</option>)}</select></label><label>或輸入新動作名稱<input list="local-exercise-list" value={exercise.name} onChange={event => updateExercise(exerciseIndex, { name: event.target.value })} placeholder="例如：槓鈴深蹲" required /></label></div>{exercises.length > 1 && <button className="danger-link" type="button" onClick={() => setExercises(rows => rows.filter((_, index) => index !== exerciseIndex))}>移除動作</button>}</div>
            <div className="sets-table"><div className="set-row set-head"><span>組</span><span>次數</span><span>重量</span><span>單位</span><span /></div>{exercise.sets.map((set, setIndex) => <div className="set-row" key={setIndex}><strong>{setIndex + 1}</strong><input type="number" inputMode={trainingInputMode("reps")} min="0" value={set.reps} onChange={event => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? { ...row, sets: row.sets.map((item, i) => i === setIndex ? { ...item, reps: event.target.value } : item) } : row))} /><input type="number" inputMode={trainingInputMode("decimal")} min="0" step=".25" value={set.weight} onChange={event => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? { ...row, sets: row.sets.map((item, i) => i === setIndex ? { ...item, weight: event.target.value } : item) } : row))} /><select value={set.unit} onChange={event => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? { ...row, sets: row.sets.map((item, i) => i === setIndex ? { ...item, unit: event.target.value as "kg" | "lb" } : item) } : row))}><option>kg</option><option>lb</option></select><button className="remove-set" type="button" disabled={exercise.sets.length === 1} onClick={() => updateExercise(exerciseIndex, { sets: exercise.sets.filter((_, index) => index !== setIndex) })}>×</button></div>)}</div>
            <div className="row"><button className="button light add-set" type="button" onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, { reps: "10", weight: "", unit: "kg" }] })}>＋ 新增一組</button><button className="button light copy-first-weight" type="button" disabled={!canCopyFirstSetWeight(exercise)} onClick={() => updateExercise(exerciseIndex, copyFirstSetWeight(exercise))}>套用第 1 組重量</button></div>
          </div>)}</div>
          <button className="button light" type="button" onClick={() => setExercises(rows => [...rows, blankExercise()])}>＋ 新增另一個動作</button>
          <button className="session-submit">儲存本次訓練</button>
        </form>
      </div>
      <div className="card" id="body-metrics"><h2>新增身體數據</h2><form className="stack" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); replace({ ...student, metrics: [...student.metrics, { id: uid(), date: String(form.get("date")), weight: String(form.get("weight") || ""), bodyFat: String(form.get("bodyFat") || ""), muscle: String(form.get("muscle") || ""), fatMass: String(form.get("fatMass") || "") }] }); }}><label>測量日期<input name="date" type="date" defaultValue={today()} required /></label><div className="row"><label>體重 kg<input name="weight" type="number" inputMode={trainingInputMode("decimal")} min="0" step=".1" /></label><label>體脂 %<input name="bodyFat" type="number" inputMode={trainingInputMode("decimal")} min="0" step=".1" /></label></div><div className="row"><label>肌肉量 kg<input name="muscle" type="number" inputMode={trainingInputMode("decimal")} min="0" step=".1" /></label><label>脂肪重量 kg<input name="fatMass" type="number" inputMode={trainingInputMode("decimal")} min="0" step=".1" /></label></div><button>儲存身體數據</button></form></div>
    </div>
    <section className="history-section" id="history"><div className="section-title"><div><div className="eyebrow">課程歷史</div><h2>過去訓練紀錄</h2></div><span className="muted">共 {student.sessions.length} 堂</span></div>{student.sessions.length ? <div className="session-history">{student.sessions.map((session, index) => <article className="card session-card" key={session.id}><div className="session-date"><div>{index === 0 && <span className="latest-badge">最新紀錄</span>}<strong>{new Date(session.date).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })}</strong></div><time>{new Date(session.date).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} · {session.exercises.length} 個動作 · {session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)} 組</time></div>{session.notes && <p className="session-note">{session.notes}</p>}<div className="history-exercises">{session.exercises.map(exercise => <div className="history-exercise" key={exercise.name}><h3>{exercise.name}</h3><div className="history-sets">{exercise.sets.map((set, setIndex) => <span key={setIndex}>第 {setIndex + 1} 組　<strong>{set.weight || "—"} {set.unit}</strong> × {set.reps || "—"}</span>)}</div></div>)}</div></article>)}</div> : <div className="card empty">尚無訓練紀錄，完成上方表單後會顯示在這裡。</div>}</section>
    <section className="card csv-tools"><div><div className="eyebrow">資料備份</div><h2>本機資料備份</h2><p>本機資料只存在這台裝置，建議定期備份。</p></div><button onClick={() => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `coachlog-backup-${today()}.json`; link.click(); URL.revokeObjectURL(url); }}>匯出本機備份</button></section>
  </main>;
}
