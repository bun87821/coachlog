"use client";

import { useEffect, useRef, useState } from "react";
import "./RestTimer.css";

const presets = [
  { label: "30 秒", seconds: 30 },
  { label: "1 分鐘", seconds: 60 },
  { label: "1 分半", seconds: 90 },
  { label: "2 分鐘", seconds: 120 },
];

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function RestTimer() {
  const [duration, setDuration] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [customSeconds, setCustomSeconds] = useState("");
  const endAt = useRef<number | null>(null);
  const completed = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const originalTitle = useRef("");

  const prepareNotification = async () => {
    try {
      const AudioContextClass = window.AudioContext;
      audioContext.current ||= new AudioContextClass();
      await audioContext.current.resume();
    } catch {}
    if ("Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
  };

  const start = async (seconds: number) => {
    const safeSeconds = Math.max(5, Math.min(3600, Math.round(seconds)));
    await prepareNotification();
    setDuration(safeSeconds);
    setRemaining(safeSeconds);
    setDone(false);
    completed.current = false;
    endAt.current = Date.now() + safeSeconds * 1000;
    setRunning(true);
  };

  const announceDone = () => {
    setDone(true);
    navigator.vibrate?.([180, 100, 180]);
    try {
      const context = audioContext.current;
      if (context) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(.18, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .7);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + .7);
      }
    } catch {}
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("休息時間結束", { body: "可以開始下一組了！", tag: "coachlog-rest-timer" }); } catch {}
    }
    document.title = "時間到！｜CoachLog";
    window.setTimeout(() => { document.title = originalTitle.current; }, 5000);
  };

  useEffect(() => {
    originalTitle.current = document.title;
  }, []);

  useEffect(() => {
    if (!running || endAt.current === null) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((endAt.current! - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0 && !completed.current) {
        completed.current = true;
        setRunning(false);
        endAt.current = null;
        announceDone();
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [running]);

  const pause = () => {
    if (endAt.current !== null) setRemaining(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)));
    endAt.current = null;
    setRunning(false);
  };

  const resume = async () => {
    await prepareNotification();
    endAt.current = Date.now() + remaining * 1000;
    setDone(false);
    completed.current = false;
    setRunning(true);
  };

  const reset = () => {
    endAt.current = null;
    setRunning(false);
    setDone(false);
    completed.current = false;
    setRemaining(duration);
    document.title = originalTitle.current;
  };

  return <section className={`rest-timer ${running ? "running" : ""} ${done ? "done" : ""}`} aria-labelledby="rest-timer-title">
    <div className="rest-timer-head"><div><span>組間休息</span><h3 id="rest-timer-title">休息計時器</h3></div><output aria-live="polite" aria-label={`剩餘 ${remaining} 秒`}>{formatTime(remaining)}</output></div>
    <div className="timer-presets" aria-label="快速開始計時">{presets.map(preset => <button type="button" onClick={() => start(preset.seconds)} key={preset.seconds}>{preset.label}</button>)}</div>
    <div className="custom-timer"><label>自訂秒數<input type="number" inputMode="numeric" min="5" max="3600" step="5" value={customSeconds} onChange={event => setCustomSeconds(event.target.value)} placeholder="例如 45" /></label><button type="button" disabled={!customSeconds || Number(customSeconds) < 5} onClick={() => start(Number(customSeconds))}>開始</button></div>
    {(running || remaining !== duration || done) && <div className="timer-controls">{running ? <button className="button light" type="button" onClick={pause}>暫停</button> : !done && remaining > 0 ? <button className="button light" type="button" onClick={resume}>繼續</button> : null}<button className="button light" type="button" onClick={reset}>重設</button></div>}
    <p className="timer-status" role={done ? "alert" : "status"}>{done ? "時間到！可以開始下一組了。" : running ? "倒數中，時間到會提醒你。" : "點選常用時間即可開始。"}</p>
  </section>;
}
