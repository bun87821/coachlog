export type TrainingSetRow = {
  reps: string;
  weight: string;
  unit: "kg" | "lb";
};

export type TrainingExerciseRow = {
  name: string;
  sets: TrainingSetRow[];
};

export type TrainingDraft = {
  date: string;
  notes: string;
  exercises: TrainingExerciseRow[];
};

export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
};

export function trainingDraftKey(scope: "cloud" | "local", studentId: string) {
  return `coachlog-training-draft-v1:${scope}:${studentId}`;
}

export function readTrainingDraft(storage: DraftStorage, key: string): TrainingDraft | null {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) as TrainingDraft : null;
  } catch {
    return null;
  }
}

export function writeTrainingDraft(storage: DraftStorage, key: string, draft: TrainingDraft) {
  storage.setItem(key, JSON.stringify(draft));
}

export function copyFirstSetWeight(exercise: TrainingExerciseRow): TrainingExerciseRow {
  const first = exercise.sets[0];
  if (!first?.weight) return exercise;
  return {
    ...exercise,
    sets: exercise.sets.map((set, index) => index === 0 ? set : {
      ...set,
      weight: first.weight,
      unit: first.unit,
    }),
  };
}

export function canCopyFirstSetWeight(exercise: TrainingExerciseRow) {
  return exercise.sets.length > 1 && Boolean(exercise.sets[0]?.weight);
}

export function trainingInputMode(kind: "reps" | "decimal") {
  return kind === "reps" ? "numeric" as const : "decimal" as const;
}

export async function finalizeTrainingDraft<T>(
  storage: DraftStorage,
  key: string,
  save: () => Promise<T>,
) {
  const result = await save();
  storage.removeItem(key);
  return result;
}

export type TrainingParticipant = {
  id: string;
  name: string;
};

export type GroupExerciseRow = {
  name: string;
  setsByStudent: Record<string, TrainingSetRow[]>;
};

export type GroupTrainingDraft = {
  date: string;
  notesByStudent: Record<string, string>;
  exercises: GroupExerciseRow[];
};

export type TrainingSessionPayload = {
  studentId: string;
  notes: string;
  exercises: TrainingExerciseRow[];
};

export function trainingDraftKeyFor(scope: "cloud" | "local", studentIds: string[]) {
  const sorted = [...studentIds].sort();
  if (sorted.length <= 1) return trainingDraftKey(scope, sorted[0] || "");
  return `coachlog-training-draft-v1:${scope}:group:${sorted.join("+")}`;
}

export function exerciseParticipants(exercise: GroupExerciseRow) {
  return Object.keys(exercise.setsByStudent);
}

export function isExerciseParticipant(exercise: GroupExerciseRow, studentId: string) {
  return Boolean(exercise.setsByStudent[studentId]);
}

export function toggleExerciseParticipant(exercise: GroupExerciseRow, studentId: string, startingSets: TrainingSetRow[]): GroupExerciseRow {
  const next = { ...exercise.setsByStudent };
  if (next[studentId]) delete next[studentId];
  else next[studentId] = startingSets;
  return { ...exercise, setsByStudent: next };
}

export function studentExercises(exercises: GroupExerciseRow[], studentId: string): TrainingExerciseRow[] {
  return exercises
    .filter(exercise => (exercise.setsByStudent[studentId] || []).length > 0)
    .map(exercise => ({ name: exercise.name, sets: exercise.setsByStudent[studentId] }));
}

export function trainingSessionPayload(
  participants: TrainingParticipant[],
  exercises: GroupExerciseRow[],
  notesByStudent: Record<string, string>,
): TrainingSessionPayload[] {
  return participants
    .map(participant => ({
      studentId: participant.id,
      notes: notesByStudent[participant.id] || "",
      exercises: studentExercises(exercises, participant.id),
    }))
    .filter(entry => entry.exercises.length > 0);
}

export function normalizeTrainingDraft(raw: unknown, participantIds: string[]): GroupTrainingDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const draft = raw as Partial<GroupTrainingDraft> & Partial<TrainingDraft>;
  if (!Array.isArray(draft.exercises)) return null;
  const allowed = new Set(participantIds);
  const soleParticipant = participantIds.length === 1 ? participantIds[0] : null;

  const exercises = draft.exercises.map(exercise => {
    const legacySets = (exercise as unknown as TrainingExerciseRow).sets;
    if (Array.isArray(legacySets)) {
      return { name: exercise.name || "", setsByStudent: soleParticipant ? { [soleParticipant]: legacySets } : {} };
    }
    const stored = (exercise as GroupExerciseRow).setsByStudent;
    const setsByStudent: Record<string, TrainingSetRow[]> = {};
    for (const [studentId, sets] of Object.entries(stored || {})) {
      if (allowed.has(studentId) && Array.isArray(sets)) setsByStudent[studentId] = sets;
    }
    return { name: exercise.name || "", setsByStudent };
  }).filter(exercise => Object.keys(exercise.setsByStudent).length > 0);

  if (!exercises.length) return null;

  const legacyNotes = (draft as TrainingDraft).notes;
  const notesByStudent: Record<string, string> = {};
  if (typeof legacyNotes === "string" && soleParticipant) notesByStudent[soleParticipant] = legacyNotes;
  for (const [studentId, note] of Object.entries((draft as GroupTrainingDraft).notesByStudent || {})) {
    if (allowed.has(studentId) && typeof note === "string") notesByStudent[studentId] = note;
  }

  return { date: typeof draft.date === "string" ? draft.date : "", notesByStudent, exercises };
}

export function writeGroupTrainingDraft(storage: DraftStorage, key: string, draft: GroupTrainingDraft) {
  storage.setItem(key, JSON.stringify(draft));
}

/** 從表單的 sessionsJson 取出單一學生的動作清單（編輯既有課堂時使用）。 */
export function exercisesFromSessionsPayload(raw: string, studentId: string): TrainingExerciseRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("訓練內容格式不正確，請重新整理後再試一次");
  }
  if (!Array.isArray(parsed)) throw new Error("訓練內容格式不正確，請重新整理後再試一次");
  const entry = (parsed as TrainingSessionPayload[]).find(item => item?.studentId === studentId);
  return entry?.exercises || [];
}

export type LastPerformance = {
  occurredAt: string;
  sets: TrainingSetRow[];
};

/** 每位學生、每個動作，最近一次做的組數內容。 */
export type LastPerformanceByStudent = Record<string, Record<string, LastPerformance>>;

/** 單位改成整個動作共用一個，所以套用到這個動作底下每位學生的每一組。 */
export function applyUnitToExercise(exercise: GroupExerciseRow, unit: TrainingSetRow["unit"]): GroupExerciseRow {
  return {
    ...exercise,
    setsByStudent: Object.fromEntries(
      Object.entries(exercise.setsByStudent).map(([studentId, sets]) => [studentId, sets.map(set => ({ ...set, unit }))]),
    ),
  };
}

export function exerciseUnit(exercise: GroupExerciseRow): TrainingSetRow["unit"] {
  for (const sets of Object.values(exercise.setsByStudent)) {
    if (sets[0]) return sets[0].unit;
  }
  return "kg";
}

/**
 * 打完第一組就往下套用到還沒填、或原本跟著第一組的組別。
 * 已經被改成別的數字的組別不會被蓋掉，所以遞減組的紀錄仍然安全。
 */
export function propagateFirstSet(
  sets: TrainingSetRow[],
  field: "reps" | "weight",
  previous: string,
  next: string,
): TrainingSetRow[] {
  return sets.map((set, index) => {
    if (index === 0) return { ...set, [field]: next };
    const following = set[field] === "" || set[field] === previous;
    return following ? { ...set, [field]: next } : set;
  });
}

/** 這個動作還沒有任何人填過重量，代表可以安全地帶入上次的數字。 */
export function isExercisePristine(exercise: GroupExerciseRow) {
  return Object.values(exercise.setsByStudent).every(sets => sets.every(set => set.weight === ""));
}

/**
 * 選好動作後，把每位學生自己上次做這個動作的內容帶進來。
 * 沒有紀錄的學生保留原本的組數；給了 fallback 則改用 fallback，
 * 用於「換成另一個動作」時清掉上一個動作帶進來的數字。
 */
export function prefillFromLastPerformance(
  exercise: GroupExerciseRow,
  name: string,
  last: LastPerformanceByStudent,
  fallback?: TrainingSetRow[],
): GroupExerciseRow {
  const setsByStudent = Object.fromEntries(
    Object.entries(exercise.setsByStudent).map(([studentId, sets]) => {
      const previous = last[studentId]?.[name];
      if (previous?.sets.length) return [studentId, previous.sets.map(set => ({ ...set }))];
      return [studentId, fallback ? fallback.map(set => ({ ...set })) : sets];
    }),
  );
  return { ...exercise, name, setsByStudent };
}

/** 目前的內容是不是就是上次帶入的紀錄（教練還沒動過）。 */
export function matchesLastPerformance(exercise: GroupExerciseRow, name: string, last: LastPerformanceByStudent) {
  if (!name) return false;
  const entries = Object.entries(exercise.setsByStudent);
  if (!entries.length) return false;
  return entries.every(([studentId, sets]) => {
    const previous = last[studentId]?.[name];
    if (!previous) return sets.every(set => set.weight === "");
    return sets.length === previous.sets.length
      && sets.every((set, index) => set.reps === previous.sets[index].reps && set.weight === previous.sets[index].weight && set.unit === previous.sets[index].unit);
  });
}
