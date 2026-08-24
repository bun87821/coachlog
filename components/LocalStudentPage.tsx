"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressCharts } from "@/components/ProgressCharts";
import { StudentSectionNav } from "@/components/StudentSectionNav";
import { uid, type LocalCoachData, type LocalStudent } from "@/lib/local-coach-data";
import {
  canCopyFirstSetWeight,
  copyFirstSetWeight,
  exerciseParticipants,
  finalizeTrainingDraft,
  isExerciseParticipant,
  normalizeTrainingDraft,
  studentExercises,
  toggleExerciseParticipant,
  trainingDraftKeyFor,
  trainingInputMode,
  trainingSessionPayload,
  writeGroupTrainingDraft,
  type GroupExerciseRow,
  type TrainingSetRow,
} from "@/lib/training-form-state";
import { nextFieldOnEnter, selectOnFocus } from "@/lib/number-input";
import "./WorkoutCsvTools.css";

const today = () => new Date().toISOString().slice(0, 10);
const startingSets = (): TrainingSetRow[] => Array.from({ length: 4 }, () => ({ reps: "10", weight: "", unit: "kg" as const }));
const blankExercise = (participantIds: string[]): GroupExerciseRow => ({ name: "", setsByStudent: Object.fromEntries(participantIds.map(id => [id, startingSets()])) });

export function LocalStudentPage({ data, studentId, partnerIds, onPartnersChange, startAt, update, back }: { data: LocalCoachData; studentId: string; partnerIds: string[]; onPartnersChange: (ids: string[]) => void; startAt?: string; update: (data: LocalCoachData) => void; back: () => void }) {
  const student = data.students.find(item => item.id === studentId)!;
  const candidates = data.students.filter(item => item.id !== studentId).map(item => ({ id: item.id, name: item.name }));
  const partners = partnerIds.map(id => candidates.find(candidate => candidate.id === id)).filter(Boolean) as Array<{ id: string; name: string }>;
  const participants = [{ id: student.id, name: student.name }, ...partners];
  const participantIds = participants.map(participant => participant.id);
  const isGroup = participants.length > 1;
  const [exercises, setExercises] = useState<GroupExerciseRow[]>([blankExercise(participantIds)]);
  const [date, setDate] = useState(startAt || `${today()}T09:00`);
  const [notesByStudent, setNotesByStudent] = useState<Record<string, string>>({});
  const [activeStudent, setActiveStudent] = useState(student.id);
  const [picking, setPicking] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const skipNextAutosave = useRef(false);
  const draftKey = trainingDraftKeyFor("local", participantIds);
  const payload = trainingSessionPayload(participants, exercises, notesByStudent);
  const activeName = participants.find(participant => participant.id === activeStudent)?.name || "";
  const partnersByGroup = data.students.reduce((all: Record<string, string[]>, item) => {
    if (item.id === student.id) return all;
    for (const session of item.sessions) if (session.groupId) (all[session.groupId] ||= []).push(item.name);
    return all;
  }, {});
  const replace = (next: LocalStudent) => update({ ...data, students: data.students.map(item => item.id === student.id ? next : item) });
  const loads = student.sessions.flatMap(session => session.exercises.map(exercise => ({ name: exercise.name, date: session.date.slice(0, 10), weight: Math.max(...exercise.sets.map(set => (Number(set.weight) || 0) * (set.unit === "lb" ? .453592 : 1))) })));

  useEffect(() => {
    if (!participantIds.includes(activeStudent)) setActiveStudent(student.id);
  }, [activeStudent, participantIds, student.id]);

  useEffect(() => {
    let stored: unknown = null;
    try { stored = JSON.parse(window.localStorage.getItem(draftKey) || "null"); } catch { stored = null; }
    const draft = normalizeTrainingDraft(stored, participantIds);
    if (draft) {
      setDate(draft.date || startAt || `${today()}T09:00`);
      setNotesByStudent(draft.notesByStudent);
      setExercises(draft.exercises);
      setDraftRestored(true);
    } else {
      setExercises([blankExercise(participantIds)]);
      setNotesByStudent({});
      setDraftRestored(false);
    }
    setDraftReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    writeGroupTrainingDraft(window.localStorage, draftKey, { date, notesByStudent, exercises });
  }, [date, draftKey, draftReady, exercises, notesByStudent]);

  const updateExercise = (exerciseIndex: number, next: GroupExerciseRow) => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? next : row));
  const updateSets = (exerciseIndex: number, studentId: string, sets: TrainingSetRow[]) => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? { ...row, setsByStudent: { ...row.setsByStudent, [studentId]: sets } } : row));
  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<TrainingSetRow>) => setExercises(rows => rows.map((row, index) => {
    if (index !== exerciseIndex) return row;
    const sets = (row.setsByStudent[activeStudent] || []).map((set, i) => i === setIndex ? { ...set, ...patch } : set);
    return { ...row, setsByStudent: { ...row.setsByStudent, [activeStudent]: sets } };
  }));

  const saveSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const entries = payload.map(entry => ({ ...entry, exercises: entry.exercises.filter(exercise => exercise.name.trim()) })).filter(entry => entry.exercises.length);
    if (!entries.length) return;
    const groupId = entries.length > 1 ? uid() : undefined;
    const exerciseNames = [...new Set([...data.exerciseNames, ...entries.flatMap(entry => entry.exercises.map(exercise => exercise.name.trim()))])].sort();
    const next = {
      ...data,
      exerciseNames,
      students: data.students.map(item => {
        const entry = entries.find(candidate => candidate.studentId === item.id);
        if (!entry) return item;
        return { ...item, sessions: [{ id: uid(), date, notes: entry.notes, exercises: entry.exercises, ...(groupId ? { groupId } : {}) }, ...item.sessions] };
      }),
    };
    try {
      await finalizeTrainingDraft(window.localStorage, draftKey, async () => update(next));
      skipNextAutosave.current = true;
      setExercises([blankExercise(participantIds)]);
      setDate(startAt || `${today()}T09:00`);
      setNotesByStudent({});
      setDraftRestored(false);
      setSaveMessage(isGroup ? `已儲存 ${entries.length} 位學生的訓練紀錄。` : "本次訓練已儲存。");
    } catch {
      setSaveMessage("儲存失敗，草稿仍保留，請稍後再試。");
    }
  };

  return <main className="shell local-app">
    <nav className="topbar"><button className="brand local-brand-button" onClick={back}>Coach<span>Log</span></button><span className="local-badge">本機模式</span></nav>
    <StudentSectionNav trailing={<button type="button" onClick={back}>學生預約</button>} />
    <button className="muted local-back-link" onClick={back}>← 返回學生列表</button>
    <div className="section-title student-heading" id="student-overview"><div><div className="eyebrow">學生紀錄</div><h1>{student.name}</h1><div className="muted">{student.email} {student.phone}</div></div><a className="button mobile-quick-add" href="#new-workout">＋ 新增訓練</a></div>
    <section className="progress-section" id="progress"><div className="section-title"><div><div className="eyebrow">進步趨勢</div><h2>數據曲線</h2></div></div><ProgressCharts metrics={student.metrics.map(metric => ({ date: metric.date, weight: Number(metric.weight) || null, bodyFat: Number(metric.bodyFat) || null, muscle: Number(metric.muscle) || null, fatMass: Number(metric.fatMass) || null }))} loads={loads} /></section>
    <div className="record-layout">
      <section className="record-section" id="new-workout">
        <div className="section-title"><div><div className="eyebrow">新增紀錄</div><h2>本次訓練內容</h2></div></div>
        <div className="card">
        {!isGroup && student.sessions[0] && <button className="copy-workout" type="button" onClick={() => setExercises(student.sessions[0].exercises.map(exercise => ({ name: exercise.name, setsByStudent: { [student.id]: structuredClone(exercise.sets) } })))}><span>⧉</span><span><strong>複製上次菜單</strong><small>複製後可自由調整重量與次數</small></span></button>}
        <p className="copy-status" aria-live="polite">{saveMessage || (draftRestored ? "已恢復尚未儲存的訓練草稿。" : "")}</p>
        <div className="session-participants">
          <div className="participant-list">
            <span className="participant-chip owner">{student.name}</span>
            {partners.map(partner => <span className="participant-chip included" key={partner.id}>{partner.name}<button type="button" aria-label={`移除 ${partner.name}`} onClick={() => onPartnersChange(partnerIds.filter(id => id !== partner.id))}>×</button></span>)}
            {candidates.length > 0 && <button type="button" className="participant-chip add" aria-expanded={picking} onClick={() => setPicking(value => !value)}>＋ 一起上課的學生</button>}
            {isGroup && <span className="group-badge">一對{participants.length}</span>}
          </div>
          {picking && <div className="participant-picker"><ul>{candidates.map(candidate => {
            const included = partnerIds.includes(candidate.id);
            return <li key={candidate.id}><button type="button" className={included ? "included" : ""} aria-pressed={included} onClick={() => onPartnersChange(included ? partnerIds.filter(id => id !== candidate.id) : [...partnerIds, candidate.id])}>{candidate.name}</button></li>;
          })}</ul></div>}
        </div>
        <form className="stack" onSubmit={saveSession}>
          <label>上課時間<input name="date" type="datetime-local" value={date} onChange={event => setDate(event.target.value)} required /></label>
          {isGroup && <div className="participant-tabs" role="tablist" aria-label="切換學生">{participants.map(participant => {
            const rows = studentExercises(exercises, participant.id);
            return <button key={participant.id} type="button" role="tab" aria-selected={participant.id === activeStudent} className={`participant-tab ${participant.id === activeStudent ? "active" : ""}`} onClick={() => setActiveStudent(participant.id)}><strong>{participant.name}</strong><small>{rows.length} 個動作 · {rows.reduce((total, exercise) => total + exercise.sets.length, 0)} 組</small></button>;
          })}</div>}
          <textarea name="notes" value={notesByStudent[activeStudent] || ""} onChange={event => setNotesByStudent(notes => ({ ...notes, [activeStudent]: event.target.value }))} placeholder={isGroup ? `${activeName}的課程備註、狀態或下次調整方向` : "本次課程備註、學生狀態或下次調整方向"} />
          <datalist id="local-exercise-list">{data.exerciseNames.map(name => <option key={name}>{name}</option>)}</datalist>
          <div className="exercise-editor">{exercises.map((exercise, exerciseIndex) => {
            const sets = exercise.setsByStudent[activeStudent];
            const joined = isExerciseParticipant(exercise, activeStudent);
            return <div className="exercise-block" key={exerciseIndex}>
              <div className="exercise-title-row"><div className="exercise-name-fields"><label>動作 {exerciseIndex + 1}<select value={data.exerciseNames.includes(exercise.name) ? exercise.name : ""} onChange={event => updateExercise(exerciseIndex, { ...exercise, name: event.target.value })}><option value="">選擇既有動作</option>{data.exerciseNames.map(name => <option key={name}>{name}</option>)}</select></label><label>或輸入新動作名稱<input list="local-exercise-list" value={exercise.name} onChange={event => updateExercise(exerciseIndex, { ...exercise, name: event.target.value })} placeholder="例如：槓鈴深蹲" required /></label></div>{exercises.length > 1 && <button className="danger-link" type="button" onClick={() => setExercises(rows => rows.filter((_, index) => index !== exerciseIndex))}>移除動作</button>}</div>
              {isGroup && <div className="exercise-participants"><span className="set-head">誰做這個動作</span>{participants.map(participant => {
                const included = isExerciseParticipant(exercise, participant.id);
                const onlyOne = included && exerciseParticipants(exercise).length === 1;
                return <button key={participant.id} type="button" className={`participant-chip ${included ? "included" : ""}`} aria-pressed={included} disabled={onlyOne} title={onlyOne ? "每個動作至少要有一位學生" : undefined} onClick={() => updateExercise(exerciseIndex, toggleExerciseParticipant(exercise, participant.id, startingSets()))}>{participant.name}</button>;
              })}</div>}
              {joined && sets ? <>
                <div className="sets-table"><div className="set-row set-head"><span>組</span><span>次數</span><span>重量</span><span>單位</span><span /></div>{sets.map((set, setIndex) => <div className="set-row" key={setIndex}><strong>{setIndex + 1}</strong><input {...selectOnFocus} {...nextFieldOnEnter} type="number" inputMode={trainingInputMode("reps")} min="0" value={set.reps} onChange={event => updateSet(exerciseIndex, setIndex, { reps: event.target.value })} /><input {...selectOnFocus} {...nextFieldOnEnter} type="number" inputMode={trainingInputMode("decimal")} min="0" step=".25" value={set.weight} onChange={event => updateSet(exerciseIndex, setIndex, { weight: event.target.value })} /><select value={set.unit} onChange={event => updateSet(exerciseIndex, setIndex, { unit: event.target.value as "kg" | "lb" })}><option>kg</option><option>lb</option></select><button className="remove-set" type="button" disabled={sets.length === 1} onClick={() => updateSets(exerciseIndex, activeStudent, sets.filter((_, index) => index !== setIndex))}>×</button></div>)}</div>
                <div className="row"><button className="button light add-set" type="button" onClick={() => updateSets(exerciseIndex, activeStudent, [...sets, { reps: "10", weight: "", unit: "kg" }])}>＋ 新增一組</button><button className="button light copy-first-weight" type="button" disabled={!canCopyFirstSetWeight({ name: exercise.name, sets })} onClick={() => updateSets(exerciseIndex, activeStudent, copyFirstSetWeight({ name: exercise.name, sets }).sets)}>套用第 1 組重量</button></div>
              </> : <p className="exercise-skipped">{activeName}今天沒有做這個動作，點上方名字即可加入。</p>}
            </div>;
          })}</div>
          <button className="button light" type="button" onClick={() => setExercises(rows => [...rows, blankExercise(participantIds)])}>＋ 新增另一個動作</button>
          {isGroup && <p className="save-summary">{payload.length ? `將建立 ${payload.length} 筆紀錄：${payload.map(entry => `${participants.find(participant => participant.id === entry.studentId)?.name} ${entry.exercises.length} 動作`).join("、")}` : "還沒有任何學生填寫紀錄。"}</p>}
          <button className="session-submit" disabled={!payload.length}>{isGroup ? `儲存 ${participants.length} 人紀錄` : "儲存本次訓練"}</button>
        </form>
        </div>
      </section>
      <section className="record-section" id="body-metrics"><div className="section-title"><div><div className="eyebrow">身體數據</div><h2>新增身體數據</h2></div></div><div className="card"><form className="stack" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); replace({ ...student, metrics: [...student.metrics, { id: uid(), date: String(form.get("date")), weight: String(form.get("weight") || ""), bodyFat: String(form.get("bodyFat") || ""), muscle: String(form.get("muscle") || ""), fatMass: String(form.get("fatMass") || "") }] }); }}><label>測量日期<input name="date" type="date" defaultValue={today()} required /></label><div className="row"><label>體重 kg<input {...selectOnFocus} {...nextFieldOnEnter} name="weight" type="number" inputMode={trainingInputMode("decimal")} min="0" step=".1" /></label><label>體脂 %<input {...selectOnFocus} {...nextFieldOnEnter} name="bodyFat" type="number" inputMode={trainingInputMode("decimal")} min="0" step=".1" /></label></div><div className="row"><label>肌肉量 kg<input {...selectOnFocus} {...nextFieldOnEnter} name="muscle" type="number" inputMode={trainingInputMode("decimal")} min="0" step=".1" /></label><label>脂肪重量 kg<input {...selectOnFocus} {...nextFieldOnEnter} name="fatMass" type="number" inputMode={trainingInputMode("decimal")} min="0" step=".1" /></label></div><button>儲存身體數據</button></form></div></section>
    </div>
    <section className="history-section" id="history"><div className="section-title"><div><div className="eyebrow">課程歷史</div><h2>過去訓練紀錄</h2></div><span className="muted">共 {student.sessions.length} 堂</span></div>{student.sessions.length ? <div className="session-history">{student.sessions.map((session, index) => <article className="card session-card" key={session.id}><div className="session-date"><div>{index === 0 && <span className="latest-badge">最新紀錄</span>}<strong>{new Date(session.date).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })}</strong></div><time>{new Date(session.date).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} · {session.exercises.length} 個動作 · {session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)} 組</time>{session.groupId && partnersByGroup[session.groupId]?.length ? <span className="partner-badge">與 {partnersByGroup[session.groupId].join("、")} 一起上課</span> : null}</div>{session.notes && <p className="session-note">{session.notes}</p>}<div className="history-exercises">{session.exercises.map(exercise => <div className="history-exercise" key={exercise.name}><h3>{exercise.name}</h3><div className="history-sets">{exercise.sets.map((set, setIndex) => <span key={setIndex}>第 {setIndex + 1} 組　<strong>{set.weight || "—"} {set.unit}</strong> × {set.reps || "—"}</span>)}</div></div>)}</div></article>)}</div> : <div className="card empty">尚無訓練紀錄，完成上方表單後會顯示在這裡。</div>}</section>
    <section className="card csv-tools"><div><div className="eyebrow">資料備份</div><h2>本機資料備份</h2><p>本機資料只存在這台裝置，建議定期備份。</p></div><button onClick={() => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `coachlog-backup-${today()}.json`; link.click(); URL.revokeObjectURL(url); }}>匯出本機備份</button></section>
  </main>;
}
