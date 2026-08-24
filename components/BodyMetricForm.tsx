"use client";

import { trainingInputMode } from "@/lib/training-form-state";
import { nextFieldOnEnter, selectOnFocus } from "@/lib/number-input";

export function BodyMetricForm({ action }: { action: (formData: FormData) => void }) {
  return <form className="stack" action={action}>
    <label>測量日期<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
    <div className="row">
      <label>體重 kg<input {...selectOnFocus} {...nextFieldOnEnter} name="weight" type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label>
      <label>體脂 %<input {...selectOnFocus} {...nextFieldOnEnter} name="bodyFat" type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label>
    </div>
    <div className="row">
      <label>肌肉量 kg<input {...selectOnFocus} {...nextFieldOnEnter} name="muscle" type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label>
      <label>脂肪重量 kg<input {...selectOnFocus} {...nextFieldOnEnter} name="fatMass" type="number" inputMode={trainingInputMode("decimal")} min="0" step="0.1" /></label>
    </div>
    <button>儲存身體數據</button>
  </form>;
}
