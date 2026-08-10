"use client";

import { useState } from "react";
import { addSession } from "@/app/actions";

type SetRow = { reps: string; weight: string; unit: "kg" | "lb" };
type ExerciseRow = { name: string; sets: SetRow[] };
type TemplateExercise = { name: string; sets: Array<{ reps: number | null; weight: number | null; unit: "kg" | "lb" }> };
const newSet = (): SetRow => ({ reps: "10", weight: "", unit: "kg" });
const newExercise = (): ExerciseRow => ({ name: "", sets: [newSet(), newSet(), newSet()] });

export function TrainingSessionForm({ studentId, exerciseNames, lastSession }: { studentId: string; exerciseNames: string[]; lastSession?: { occurredAt: string; exercises: TemplateExercise[] } }) {
  const [exercises, setExercises] = useState<ExerciseRow[]>([newExercise()]);
  const [copied, setCopied] = useState(false);
  const action = addSession.bind(null, studentId);
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

  return <form className="stack" action={action}>
    {lastSession && <button className="copy-workout" type="button" onClick={copyLastSession}><span>⧉</span><span><strong>複製上次菜單</strong><small>{new Date(lastSession.occurredAt).toLocaleDateString("zh-TW", { timeZone: "UTC" })} 的 {lastSession.exercises.length} 個動作，複製後可自由編輯</small></span></button>}
    <p className="copy-status" aria-live="polite">{copied ? "已複製上次菜單，可以直接調整本次重量與次數。" : ""}</p>
    <label>上課時間<input name="date" type="datetime-local" required /></label>
    <textarea name="notes" placeholder="本次課程備註、學生狀態或下次調整方向" />
    <input type="hidden" name="exercisesJson" value={JSON.stringify(exercises)} />
    <datalist id="exercise-list">{exerciseNames.map(name => <option key={name} value={name} />)}</datalist>
    <div className="exercise-editor">
      {exercises.map((exercise, exerciseIndex) => <div className="exercise-block" key={exerciseIndex}>
        <div className="exercise-title-row">
          <label>動作 {exerciseIndex + 1}<input list="exercise-list" value={exercise.name} onChange={event => updateExercise(exerciseIndex, { name: event.target.value })} placeholder="選擇或輸入新動作" required /></label>
          {exercises.length > 1 && <button className="danger-link" type="button" onClick={() => setExercises(rows => rows.filter((_, index) => index !== exerciseIndex))}>移除動作</button>}
        </div>
        <div className="sets-table">
          <div className="set-row set-head"><span>組</span><span>次數</span><span>重量</span><span>單位</span><span /></div>
          {exercise.sets.map((set, setIndex) => <div className="set-row" key={setIndex}>
            <strong>{setIndex + 1}</strong>
            <input aria-label={`動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組次數`} type="number" min="0" value={set.reps} onChange={event => updateSet(exerciseIndex, setIndex, { reps: event.target.value })} />
            <input aria-label={`動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組重量`} type="number" min="0" step="0.25" value={set.weight} onChange={event => updateSet(exerciseIndex, setIndex, { weight: event.target.value })} />
            <select aria-label={`動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組單位`} value={set.unit} onChange={event => updateSet(exerciseIndex, setIndex, { unit: event.target.value as "kg" | "lb" })}><option value="kg">kg</option><option value="lb">lb</option></select>
            <button className="remove-set" type="button" aria-label={`移除第 ${setIndex + 1} 組`} disabled={exercise.sets.length === 1} onClick={() => updateExercise(exerciseIndex, { sets: exercise.sets.filter((_, index) => index !== setIndex) })}>×</button>
          </div>)}
        </div>
        <button className="button light add-set" type="button" onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, newSet()] })}>＋ 新增一組</button>
      </div>)}
    </div>
    <button className="button light" type="button" onClick={() => setExercises(rows => [...rows, newExercise()])}>＋ 新增另一個動作</button>
    <button className="session-submit">儲存本次訓練</button>
  </form>;
}
