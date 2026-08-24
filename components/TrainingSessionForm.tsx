"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addGroupSession } from "@/app/training-session-actions";
import { updateSession } from "@/app/session-actions";
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
  type TrainingParticipant,
  type TrainingSetRow,
} from "@/lib/training-form-state";

type TemplateExercise = { name: string; sets: Array<{ reps: number | null; weight: number | null; unit: "kg" | "lb" }> };
type EditableSession = { id: string; occurredAt: string; notes: string | null; exercises: TemplateExercise[] };

const newSet = (): TrainingSetRow => ({ reps: "10", weight: "", unit: "kg" });
const startingSets = () => [newSet(), newSet(), newSet(), newSet()];
const newExercise = (participantIds: string[]): GroupExerciseRow => ({
  name: "",
  setsByStudent: Object.fromEntries(participantIds.map(id => [id, startingSets()])),
});
const templateExercises = (exercises: TemplateExercise[], participantIds: string[]): GroupExerciseRow[] => exercises.map(exercise => ({
  name: exercise.name,
  setsByStudent: Object.fromEntries(participantIds.map(id => [id, exercise.sets.map(set => ({ reps: set.reps?.toString() || "", weight: set.weight?.toString() || "", unit: set.unit }))])),
}));

export function TrainingSessionForm({ participants, exerciseNames, lastSession, session, initialDate }: { participants: TrainingParticipant[]; exerciseNames: string[]; lastSession?: { occurredAt: string; exercises: TemplateExercise[] }; session?: EditableSession; initialDate?: string }) {
  const router = useRouter();
  const participantIds = useMemo(() => participants.map(participant => participant.id), [participants]);
  const isGroup = participants.length > 1;
  const [exercises, setExercises] = useState<GroupExerciseRow[]>(session ? templateExercises(session.exercises, participantIds) : [newExercise(participantIds)]);
  const [date, setDate] = useState(session ? session.occurredAt.slice(0, 16) : initialDate || "");
  const [notesByStudent, setNotesByStudent] = useState<Record<string, string>>(session ? { [participantIds[0]]: session.notes || "" } : {});
  const [activeStudent, setActiveStudent] = useState(participantIds[0]);
  const [copied, setCopied] = useState(false);
  const [draftReady, setDraftReady] = useState(Boolean(session));
  const [draftRestored, setDraftRestored] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const skipNextAutosave = useRef(false);
  const draftKey = trainingDraftKeyFor("cloud", participantIds);
  const exerciseListId = `exercise-list-${session?.id || "new"}`;
  const editAction = session ? updateSession.bind(null, participantIds[0], session.id) : undefined;
  const payload = useMemo(() => trainingSessionPayload(participants, exercises, notesByStudent), [participants, exercises, notesByStudent]);

  useEffect(() => {
    if (!participantIds.includes(activeStudent)) setActiveStudent(participantIds[0]);
  }, [activeStudent, participantIds]);

  useEffect(() => {
    if (session) return;
    const draft = normalizeTrainingDraft(readStoredDraft(draftKey), participantIds);
    if (draft) {
      setDate(draft.date || initialDate || "");
      setNotesByStudent(draft.notesByStudent);
      setExercises(draft.exercises);
      setDraftRestored(true);
    }
    setDraftReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, participantIds, session]);

  useEffect(() => {
    if (session || !draftReady) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    writeGroupTrainingDraft(window.localStorage, draftKey, { date, notesByStudent, exercises });
  }, [date, draftKey, draftReady, exercises, notesByStudent, session]);

  const updateExercise = (exerciseIndex: number, next: GroupExerciseRow) => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? next : row));
  const updateSets = (exerciseIndex: number, studentId: string, sets: TrainingSetRow[]) => setExercises(rows => rows.map((row, index) => index === exerciseIndex ? { ...row, setsByStudent: { ...row.setsByStudent, [studentId]: sets } } : row));
  const updateSet = (exerciseIndex: number, studentId: string, setIndex: number, patch: Partial<TrainingSetRow>) => setExercises(rows => rows.map((row, index) => {
    if (index !== exerciseIndex) return row;
    const sets = (row.setsByStudent[studentId] || []).map((set, i) => i === setIndex ? { ...set, ...patch } : set);
    return { ...row, setsByStudent: { ...row.setsByStudent, [studentId]: sets } };
  }));

  const copyLastSession = () => {
    if (!lastSession) return;
    setExercises(templateExercises(lastSession.exercises, participantIds));
    setCopied(true);
  };

  const saveNewSession = async (formData: FormData) => {
    setSaving(true);
    setSaveMessage("");
    try {
      await finalizeTrainingDraft(window.localStorage, draftKey, () => addGroupSession(formData));
      skipNextAutosave.current = true;
      setExercises([newExercise(participantIds)]);
      setDate(initialDate || "");
      setNotesByStudent({});
      setCopied(false);
      setDraftRestored(false);
      setSaveMessage(isGroup ? `已儲存 ${payload.length} 位學生的訓練紀錄。` : "本次訓練已儲存。");
      router.refresh();
    } catch {
      setSaveMessage("儲存失敗，草稿仍保留，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const activeName = participants.find(participant => participant.id === activeStudent)?.name || "";

  return <form className={`stack ${session ? "session-edit-form" : ""}`} action={session ? editAction : saveNewSession}>
    {!session && lastSession && <button className="copy-workout" type="button" onClick={copyLastSession}><span>⧉</span><span><strong>複製上次菜單</strong><small>{new Date(lastSession.occurredAt).toLocaleDateString("zh-TW", { timeZone: "UTC" })} 的 {lastSession.exercises.length} 個動作，複製後可自由編輯</small></span></button>}
    <p className="copy-status" aria-live="polite">{saveMessage || (draftRestored ? "已恢復尚未儲存的訓練草稿。" : copied ? "已複製上次菜單，可以直接調整本次重量與次數。" : "")}</p>
    <label>上課時間<input name="date" type="datetime-local" value={date} onChange={event => setDate(event.target.value)} required /></label>

    {isGroup && <div className="participant-tabs" role="tablist" aria-label="切換學生">
      {participants.map(participant => {
        const count = studentExercises(exercises, participant.id);
        return <button
          key={participant.id}
          type="button"
          role="tab"
          className={`participant-tab ${participant.id === activeStudent ? "active" : ""}`}
          aria-selected={participant.id === activeStudent}
          onClick={() => setActiveStudent(participant.id)}
        >
          <strong>{participant.name}</strong>
          <small>{count.length} 個動作 · {count.reduce((total, exercise) => total + exercise.sets.length, 0)} 組</small>
        </button>;
      })}
    </div>}

    <textarea name="notes" value={notesByStudent[activeStudent] || ""} onChange={event => setNotesByStudent(notes => ({ ...notes, [activeStudent]: event.target.value }))} placeholder={isGroup ? `${activeName}的課程備註、狀態或下次調整方向` : "本次課程備註、學生狀態或下次調整方向"} />
    <input type="hidden" name="sessionsJson" value={JSON.stringify(payload)} />
    <datalist id={exerciseListId}>{exerciseNames.map(name => <option key={name} value={name} />)}</datalist>

    <div className="exercise-editor">
      {exercises.map((exercise, exerciseIndex) => {
        const sets = exercise.setsByStudent[activeStudent];
        const joined = isExerciseParticipant(exercise, activeStudent);
        return <div className="exercise-block" key={exerciseIndex}>
          <div className="exercise-title-row">
            <div className="exercise-name-fields">
              <label>動作 {exerciseIndex + 1}<select aria-label={`選擇動作 ${exerciseIndex + 1}`} value={exerciseNames.includes(exercise.name) ? exercise.name : ""} onChange={event => updateExercise(exerciseIndex, { ...exercise, name: event.target.value })}><option value="">選擇既有動作</option>{exerciseNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
              <label className="custom-exercise-label">或輸入新動作名稱<input list={exerciseListId} value={exercise.name} onChange={event => updateExercise(exerciseIndex, { ...exercise, name: event.target.value })} placeholder="例如：槓鈴深蹲" required /></label>
            </div>
            {exercises.length > 1 && <button className="danger-link" type="button" onClick={() => setExercises(rows => rows.filter((_, index) => index !== exerciseIndex))}>移除動作</button>}
          </div>

          {isGroup && <div className="exercise-participants">
            <span className="set-head">誰做這個動作</span>
            {participants.map(participant => {
              const included = isExerciseParticipant(exercise, participant.id);
              const onlyOne = included && exerciseParticipants(exercise).length === 1;
              return <button
                key={participant.id}
                type="button"
                className={`participant-chip ${included ? "included" : ""}`}
                aria-pressed={included}
                disabled={onlyOne}
                title={onlyOne ? "每個動作至少要有一位學生" : undefined}
                onClick={() => updateExercise(exerciseIndex, toggleExerciseParticipant(exercise, participant.id, startingSets()))}
              >{participant.name}</button>;
            })}
          </div>}

          {joined && sets ? <>
            <div className="sets-table">
              <div className="set-row set-head"><span>組</span><span>次數</span><span>重量</span><span>單位</span><span /></div>
              {sets.map((set, setIndex) => <div className="set-row" key={setIndex}>
                <strong>{setIndex + 1}</strong>
                <input aria-label={`${activeName}動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組次數`} type="number" inputMode={trainingInputMode("reps")} min="0" value={set.reps} onChange={event => updateSet(exerciseIndex, activeStudent, setIndex, { reps: event.target.value })} />
                <input aria-label={`${activeName}動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組重量`} type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.25" value={set.weight} onChange={event => updateSet(exerciseIndex, activeStudent, setIndex, { weight: event.target.value })} />
                <select aria-label={`${activeName}動作 ${exerciseIndex + 1} 第 ${setIndex + 1} 組單位`} value={set.unit} onChange={event => updateSet(exerciseIndex, activeStudent, setIndex, { unit: event.target.value as "kg" | "lb" })}><option value="kg">kg</option><option value="lb">lb</option></select>
                <button className="remove-set" type="button" aria-label={`移除第 ${setIndex + 1} 組`} disabled={sets.length === 1} onClick={() => updateSets(exerciseIndex, activeStudent, sets.filter((_, index) => index !== setIndex))}>×</button>
              </div>)}
            </div>
            <div className="row">
              <button className="button light add-set" type="button" onClick={() => updateSets(exerciseIndex, activeStudent, [...sets, newSet()])}>＋ 新增一組</button>
              <button className="button light copy-first-weight" type="button" disabled={!canCopyFirstSetWeight({ name: exercise.name, sets })} onClick={() => updateSets(exerciseIndex, activeStudent, copyFirstSetWeight({ name: exercise.name, sets }).sets)}>套用第 1 組重量</button>
            </div>
          </> : <p className="exercise-skipped">{activeName}今天沒有做這個動作，點上方名字即可加入。</p>}
        </div>;
      })}
    </div>

    <button className="button light" type="button" onClick={() => setExercises(rows => [...rows, newExercise(participantIds)])}>＋ 新增另一個動作</button>
    {isGroup && !session && <p className="save-summary">{payload.length ? `將建立 ${payload.length} 筆紀錄：${payload.map(entry => `${participants.find(participant => participant.id === entry.studentId)?.name} ${entry.exercises.length} 動作`).join("、")}` : "還沒有任何學生填寫紀錄。"}</p>}
    <button className="session-submit" disabled={saving || (!session && !payload.length)}>{session ? "儲存課堂修改" : saving ? "儲存中…" : isGroup ? `儲存 ${participants.length} 人紀錄` : "儲存本次訓練"}</button>
  </form>;
}

function readStoredDraft(key: string) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
