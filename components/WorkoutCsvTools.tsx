"use client";

import { importWorkoutCsv } from "@/app/workout-csv-actions";
import { useFormStatus } from "react-dom";
import "./WorkoutCsvTools.css";

function ImportButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} aria-busy={pending}>{pending ? "匯入中…" : "匯入 CSV"}</button>;
}

export function WorkoutCsvTools({ studentId, imported, skipped, error }: { studentId: string; imported?: string; skipped?: string; error?: string }) {
  const action = importWorkoutCsv.bind(null, studentId);
  return <section className="card csv-tools" id="csv-tools" aria-labelledby="csv-tools-title"><div><div className="eyebrow">資料備份</div><h2 id="csv-tools-title">訓練紀錄 CSV</h2><p>一列代表一組動作，可用 Excel、Numbers 或 Google Sheets 編輯。</p></div><div className="csv-downloads"><a className="button" href={`/api/students/${studentId}/workouts.csv`}>匯出全部紀錄</a><a className="button light" href="/api/workouts/template.csv">下載 CSV 範本</a></div><form action={action}><label>選擇要匯入的 CSV<input type="file" name="csv" accept=".csv,text/csv" required /></label><ImportButton /></form>{error && <p className="csv-message error" role="alert">{error}</p>}{imported !== undefined && <p className="csv-message success" role="status">已匯入 {imported} 堂課{Number(skipped) ? `，略過 ${skipped} 堂重複資料` : ""}。</p>}<details><summary>CSV 欄位說明</summary><p><strong>課堂識別碼</strong>用來把多列組合成同一堂課；同一堂課請使用相同識別碼。日期請填 <code>YYYY-MM-DD HH:mm</code>，單位只能填 <code>kg</code> 或 <code>lb</code>。</p></details></section>;
}
