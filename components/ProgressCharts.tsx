"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ProgressCharts({ metrics, loads }: { metrics: any[]; loads: any[] }) {
  const names = useMemo(() => Array.from(new Set(loads.map(row => row.name))) as string[], [loads]);
  const [selected, setSelected] = useState(names[0] || "");
  const selectedLoads = loads.filter(row => row.name === selected);

  return <div className="grid">
    <div className="card body-chart" style={{ gridColumn: "span 2" }}>
      <h3>身體組成趨勢</h3>
      {metrics.length ? <div className="chart"><ResponsiveContainer><LineChart data={metrics}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="weight" name="體重 kg" stroke="#176b45" /><Line type="monotone" dataKey="bodyFat" name="體脂 %" stroke="#e47c45" /><Line type="monotone" dataKey="muscle" name="肌肉量 kg" stroke="#425fc7" /><Line type="monotone" dataKey="fatMass" name="脂肪重量 kg" stroke="#9b5bb5" /></LineChart></ResponsiveContainer></div> : <div className="chart-empty">輸入兩次以上身體數據後，這裡會顯示變化曲線。</div>}
    </div>
    <div className="card">
      <div className="chart-title"><h3>動作重量曲線</h3>{names.length > 0 && <select aria-label="選擇趨勢動作" value={selected} onChange={event => setSelected(event.target.value)}>{names.map(name => <option key={name}>{name}</option>)}</select>}</div>
      {selectedLoads.length ? <>
        <p className="muted chart-caption">每次訓練的單組最高重量，統一換算為公斤。</p>
        {selectedLoads.length === 1 && <p className="trend-hint">目前只有一筆紀錄，再完成一堂就能看出重量趨勢。</p>}
        <div className="chart"><ResponsiveContainer><LineChart data={selectedLoads}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="weight" name={`${selected} 最高重量 kg`} stroke="#176b45" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
      </> : <div className="chart-empty">儲存訓練紀錄後，可選擇動作查看重量進步。</div>}
    </div>
  </div>;
}
