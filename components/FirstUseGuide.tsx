"use client";

import { useEffect, useState } from "react";
import "./FirstUseGuide.css";

const STORAGE_KEY = "coachlog-onboarding-v1";
const steps = [
  { icon: "👋", title: "歡迎使用 CoachLog", text: "把學生、每堂訓練、身體數據與預約集中在同一個地方。接下來用一分鐘認識主要功能。" },
  { icon: "📱", title: "先選擇資料放哪裡", text: "本機模式不用登入，也能使用學生紀錄與本機日曆；登入 Google 帳號後，則能跨裝置並同步 Google Calendar。" },
  { icon: "👤", title: "建立你的學生", text: "新增學生後，可以搜尋姓名，也能按住 ☰ 拖曳，按照常用預約時段調整學生順序。" },
  { icon: "🏋️", title: "記錄每一次訓練", text: "輸入動作、組數、重量與單位；可以複製上次菜單、使用休息計時器，並查看重量與身體數據曲線。" },
  { icon: "🗓️", title: "預約與資料備份", text: "不登入也能在本機日曆建立學生預約；登入後可再同步至 Google Calendar。學生頁最底部可匯出 CSV 備份訓練紀錄。" },
];

export function FirstUseGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { if (!localStorage.getItem(STORAGE_KEY)) setOpen(true); }, []);
  const close = () => { localStorage.setItem(STORAGE_KEY, "done"); setOpen(false); setStep(0); };
  return <>
    <button className="guide-launcher" type="button" onClick={() => { setStep(0); setOpen(true); }} aria-label="開啟使用教學">?</button>
    {open && <div className="guide-backdrop" role="presentation">
      <section className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <button className="guide-skip" type="button" onClick={close}>略過</button>
        <div className="guide-icon" aria-hidden="true">{steps[step].icon}</div>
        <div className="guide-progress" aria-label={`第 ${step + 1} 步，共 ${steps.length} 步`}>{steps.map((_, index) => <span className={index <= step ? "active" : ""} key={index} />)}</div>
        <p className="eyebrow">快速教學 · {step + 1}/{steps.length}</p>
        <h2 id="guide-title">{steps[step].title}</h2>
        <p className="guide-text">{steps[step].text}</p>
        <div className="guide-actions">
          {step > 0 ? <button className="button light" type="button" onClick={() => setStep(step - 1)}>上一步</button> : <span />}
          {step < steps.length - 1 ? <button type="button" onClick={() => setStep(step + 1)}>下一步</button> : <button type="button" onClick={close}>開始使用</button>}
        </div>
      </section>
    </div>}
  </>;
}
