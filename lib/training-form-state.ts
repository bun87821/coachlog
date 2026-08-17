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
