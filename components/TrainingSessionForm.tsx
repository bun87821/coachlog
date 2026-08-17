"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addSession } from "@/app/actions";
import { updateSession } from "@/app/session-actions";
import {
  canCopyFirstSetWeight,
  copyFirstSetWeight,
  finalizeTrainingDraft,
  readTrainingDraft,
  trainingDraftKey,
  trainingInputMode,
  writeTrainingDraft,
  type TrainingExerciseRow,
} from "@/lib/training-form-state";

type SetRow = TrainingExerciseRow["sets"][number];
type ExerciseRow = TrainingExerciseRow;
type TemplateExercise = { name: string; sets: Array<{ reps: number | null; weight: number | null; unit: "kg" | "lb" }> };
const newSet = (): SetRow => ({ reps: "10", weight: "", unit: "kg" });
const newExercise = (): ExerciseRow => ({ name: "", sets: [newSet(), newSet(), newSet(), newSet()] });

type EditableSession = { id: string; occurredAt: string; notes: string | null; exercises: TemplateExercise[] };

export function TrainingSessionForm({ studentId, exerciseNames, lastSession, session }: { studentId: string; exerciseNames: string[]; lastSession?: { occurredAt: string; exercises: TemplateExercise[] }; session?: EditableSession }) {
  const router = useRouter();
  const [exercises, setExercises] = useState<ExerciseRow[]>(session ? session.exercises.map(exercise => ({ name: exercise.name, sets: exercise.sets.map(set => ({ reps: set.reps?.toString() || "", weight: set.weight?.toString() || "", unit: set.unit })) })) : [newExercise()]);
  const [date, setDate] = useState(session ? session.occurredAt.slice(0, 16) : "");
  const [notes, setNotes] = useState(session?.notes || "");
  const [copied, setCopied] = useState(false);
  const [draftReady, setDraftReady] = useState(Boolean(session));
  const [draftRestored, setDraftRestored] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const skipNextAutosave = useRef(false);
  const draftKey = trainingDraftKey("cloud", studentId);
  const exerciseListId = `exercise-list-${session?.id || "new"}`;
  const editAction = session ? updateSession.bind(null, studentId, session.id) : undefined;

  useEffect(() => {
    if (session) return;
    const draft = readTrainingDraft(window.localStorage, draftKey);
    if (draft) {
      setDate(draft.date);
      setNotes(draft.notes);
      setExercises(draft.exercises);
      setDraftRestored(true);
    }
    setDraftReady(true);
  }, [draftKey, session]);

  useEffect(() => {
    if (session || !draftReady) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    writeTrainingDraft(window.localStorage, draftKey, { date, notes, exercises });
  }, [date, draftKey, draftReady, exercises, notes, session]);

  const updateExercise = (exerciseIndex: number, patch: Partial<ExerciseRow>) => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? { ...row, ...patch } : row));
  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<SetRow>) => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? { ...row, sets: row.sets.map((set, i) => i === setIndex ? { ...set, ...patch } : set) } : row));
  const copyLastSession = () => {
    if (!lastSession) return;
    setExercises(lastSession.exercises.map(exercise => ({
      name: exercise.name,
      sets: exercise.sets.map(set => ({ reps: set.reps?.toString() || "", weight: set.weight?.toString() || "", unit: set.unit })),
    })));
    setCopied(true);
  };
  const saveNewSession = async (formData: FormData) => {
    setSaving(true);
    setSaveMessage("");
    try {
      await finalizeTrainingDraft(window.localStorage, draftKey, () => addSession(studentId, formData));
      skipNextAutosave.current = true;
      setExercises([newExercise()]);
      setDate("");
      setNotes("");
      setCopied(false);
      setDraftRestored(false);
      setSaveMessage("本次訓練已儲存。");
      router.refresh();
    } catch {
      setSaveMessage("儲存失敗，草稿仍保留，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  return <form className={`stack ${session ? "session-edit-form" : ""}`} action={session ? editAction : saveNewSession}>
    {!session && lastSession && <button className="copy-workout" type="button" onClick={copyLastSession}><span>⧉</span><span><strong>複製上次菜單</strong><small>{new Date(lastSession.occurredAt).toLocaleDateString("zh-TW", { timeZone: "UTC" })} 的 {lastSession.exercises.length} 個動作，複製後可自由編輯</small></span></button>}
    <p className="copy-status" aria-live="polite">{draftRestored ? "已恢復尚未儲存的訓練草稿。" : copied ? "已複製上次菜單，可以直接調整本次重量與次數。" : saveMessage}</p>
    <label>上課時間<input name="date" type="datetime-local" value={date} onChange={event => setDate(event.target.value)} required /></label>
    <textarea name="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="本次課程備註、學生狀態或下次調整方向" />
    <input type="hidden" name="exercisesJson" value={JSON.stringify(exercises)} />
    <datalist id={exerciseListId}>{exerciseNames.map(name => <option key={name} value={name} />)}</datalist>
    <div className="exercise-editor">
      {exercises.map((exercise, exerciseIndex) => <div className="exercise-block" key={exerciseIndex}>
        <div className="exercise-title-row">
          <div className="exercise-name-fields">
            <label>動作 {exerciseIndex + 1}<select aria-label={`選擇動作 ${exerciseIndex + 1}`} value={exerciseNames.includes(exercise.name) ? exercise.name : ""} onChange={event => updateExercise(exerciseIndex, { name: event.target.value })}><option value="">選擇既有動作</option>{exerciseNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="custom-exercise-label">或輸入新動作名稱<input list={exerciseListId} value={exercise.name} onChange={event => updateExercise(exerciseIndex, { name: event.target.value })} placeholder="例如：槓鈴深蹲" required /></label>
          </div>
          {exercises.length > 1 && <button className="danger-link" type="button" onClick={() => setExercises(rows => rows.filter((_, index) => index !== exerciseIndex))}>移除動作</button>}
        </div>
        <div className="sets-table">
          <div className="set-row set-head"><span>組</span><span>次數</span><span>重量</span><span>單位</span><span /></div>
          {exercise.sets.map((set, setIndex) => <div className="set-row" key={setIndex}>
            <strong>{setIndex + 1}</strong>
            <input aria-label={`動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組次數`} type="number" inputMode={trainingInputMode("reps")} min="0" value={set.reps} onChange={event => updateSet(exerciseIndex, setIndex, { reps: event.target.value })} />
            <input aria-label={`動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組重量`} type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.25" value={set.weight} onChange={event => updateSet(exerciseIndex, setIndex, { weight: event.target.value })} />
            <select aria-label={`動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組單位`} value={set.unit} onChange={event => updateSet(exerciseIndex, setIndex, { unit: event.target.value as "kg" | "lb" })}><option value="kg">kg</option><option value="lb">lb</option></select>
            <button className="remove-set" type="button" aria-label={`移除第 ${setIndex + 1} 組`} disabled={exercise.sets.length === 1} onClick={() => updateExercise(exerciseIndex, { sets: exercise.sets.filter((_, index) => index !== setIndex) })}>×</button>
          </div>)}
        </div>
        <div className="row">
          <button className="button light add-set" type="button" onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, newSet()] })}>＋ 新增一組</button>
          <button className="button light copy-first-weight" type="button" disabled={!canCopyFirstSetWeight(exercise)} onClick={() => updateExercise(exerciseIndex, copyFirstSetWeight(exercise))}>套用第 1 組重量</button>
        </div>
      </div>)}
    </div>
    <button className="button light" type="button" onClick={() => setExercises(rows => [...rows, newExercise()])}>＋ 新增另一個動作</button>
    <button className="session-submit" disabled={saving}>{session ? "儲存課堂修改" : saving ? "儲存中…" : "儲存本次訓練"}</button>
  </form>;
}
