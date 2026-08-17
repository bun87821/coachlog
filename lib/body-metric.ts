const text = (value: FormDataEntryValue | null) => String(value || "").trim();
const numberOrNull = (value: FormDataEntryValue | null) => text(value) ? Number(value) : null;

export function bodyMetricInput(formData: FormData) {
  return {
    date: text(formData.get("date")),
    weight: numberOrNull(formData.get("weight")),
    bodyFat: numberOrNull(formData.get("bodyFat")),
    muscle: numberOrNull(formData.get("muscle")),
    fatMass: numberOrNull(formData.get("fatMass")),
  };
}
