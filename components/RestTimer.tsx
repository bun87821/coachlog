"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { selectOnFocus } from "@/lib/number-input";
import "./RestTimer.css";

const presets = [
  { label: "30 秒", seconds: 30 },
  { label: "1 分鐘", seconds: 60 },
  { label: "1 分半", seconds: 90 },
  { label: "2 分鐘", seconds: 120 },
];

const storageKey = "coachlog-rest-timer-v1";
const soundKey = "coachlog-rest-timer-sound-v1";
// 休息結束後這段時間內回到 App，仍然告訴教練「時間到」；再久就當作過期
const doneGrace = 120_000;

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function RestTimer() {
  const [duration, setDuration] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [customSeconds, setCustomSeconds] = useState("");
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const endAt = useRef<number | null>(null);
  const completed = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const beep = useRef<HTMLAudioElement | null>(null);
  const originalTitle = useRef("");
  const wrapper = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const pathname = usePathname();

  // iOS 只允許「使用者操作當下」播放過的音訊之後自動播放，
  // 而且 Web Audio 會被側邊靜音開關關掉，<audio> 走媒體聲道則不會。
  // 所以按下計時的那一刻先靜音播一次把它解鎖，時間到才有聲音。
  const unlockSound = () => {
    if (!soundOn) return;
    try {
      beep.current ||= Object.assign(new Audio("/rest-timer-done.wav"), { preload: "auto" });
      const element = beep.current;
      element.muted = true;
      element.play().then(() => {
        element.pause();
        element.currentTime = 0;
        element.muted = false;
      }).catch(() => { element.muted = false; });
    } catch {}
    try {
      const AudioContextClass = window.AudioContext;
      audioContext.current ||= new AudioContextClass();
      void audioContext.current.resume();
    } catch {}
  };

  const prepareNotification = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
  };

  const playDoneSound = () => {
    if (!soundOn) return;
    const element = beep.current;
    if (element) {
      element.currentTime = 0;
      element.play().catch(() => playFallbackTone());
      return;
    }
    playFallbackTone();
  };

  const playFallbackTone = () => {
    try {
      const context = audioContext.current;
      if (!context) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .7);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .7);
    } catch {}
  };

  const start = (seconds: number) => {
    const safeSeconds = Math.max(5, Math.min(3600, Math.round(seconds)));
    unlockSound();
    // 通知授權在背景準備；倒數不能被授權對話框擋住
    void prepareNotification();
    setDuration(safeSeconds);
    setRemaining(safeSeconds);
    setDone(false);
    completed.current = false;
    endAt.current = Date.now() + safeSeconds * 1000;
    setRunning(true);
    setOpen(false);
  };

  const announceDone = () => {
    setDone(true);
    navigator.vibrate?.([180, 100, 180]);
    playDoneSound();
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("休息時間結束", { body: "可以開始下一組了！", tag: "coachlog-rest-timer" }); } catch {}
    }
    document.title = "時間到！｜CoachLog";
    window.setTimeout(() => { document.title = originalTitle.current; }, 5000);
  };

  useEffect(() => {
    originalTitle.current = document.title;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null") as { duration?: number; endAt?: number } | null;
      if (saved?.duration) {
        setDuration(saved.duration);
        const left = saved.endAt ? saved.endAt - Date.now() : 0;
        if (left > 0) {
          endAt.current = saved.endAt!;
          setRemaining(Math.ceil(left / 1000));
          setRunning(true);
        } else if (saved.endAt && Date.now() - saved.endAt < doneGrace) {
          completed.current = true;
          setRemaining(0);
          setDone(true);
        } else {
          setRemaining(saved.duration);
          window.localStorage.removeItem(storageKey);
        }
      }
    } catch {}
    try {
      if (window.localStorage.getItem(soundKey) === "off") setSoundOn(false);
    } catch {}
    restored.current = true;
  }, []);

  // 記住倒數狀態，換頁或重開 App 都能接回去
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (running && endAt.current) window.localStorage.setItem(storageKey, JSON.stringify({ duration, endAt: endAt.current }));
      else if (done) window.localStorage.setItem(storageKey, JSON.stringify({ duration, endAt: Date.now() }));
      else window.localStorage.removeItem(storageKey);
    } catch {}
  }, [done, duration, running, remaining]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

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

  const resume = () => {
    unlockSound();
    void prepareNotification();
    endAt.current = Date.now() + remaining * 1000;
    setDone(false);
    completed.current = false;
    setRunning(true);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try { window.localStorage.setItem(soundKey, next ? "on" : "off"); } catch {}
    if (next) {
      try {
        beep.current ||= Object.assign(new Audio("/rest-timer-done.wav"), { preload: "auto" });
        beep.current.currentTime = 0;
        beep.current.play().catch(() => {});
      } catch {}
    }
  };

  const reset = () => {
    endAt.current = null;
    setRunning(false);
    setDone(false);
    completed.current = false;
    setRemaining(duration);
    document.title = originalTitle.current;
  };

  const label = done ? "時間到" : running ? `休息中 ${formatTime(remaining)}` : "休息計時器";
  // 記錄訓練的頁面隨時可開；其他頁面只在倒數中或時間到時出現
  const onRecordingPage = pathname === "/local" || pathname.startsWith("/students/");
  if (!onRecordingPage && !running && !done) return null;

  return <div className={`rest-timer ${running ? "running" : ""} ${done ? "done" : ""}`} ref={wrapper}>
    {open && <section className="rest-timer-panel" aria-labelledby="rest-timer-title">
      <div className="rest-timer-head"><div><span>組間休息</span><h3 id="rest-timer-title">休息計時器</h3></div><output aria-live="polite" aria-label={`剩餘 ${remaining} 秒`}>{formatTime(remaining)}</output></div>
      <div className="timer-presets" aria-label="快速開始計時">{presets.map(preset => <button type="button" onClick={() => start(preset.seconds)} key={preset.seconds}>{preset.label}</button>)}</div>
      <div className="custom-timer"><label>自訂秒數<input {...selectOnFocus} type="number" inputMode="numeric" min="5" max="3600" step="5" value={customSeconds} onChange={event => setCustomSeconds(event.target.value)} placeholder="例如 45" /></label><button type="button" disabled={!customSeconds || Number(customSeconds) < 5} onClick={() => start(Number(customSeconds))}>開始</button></div>
      {(running || remaining !== duration || done) && <div className="timer-controls">{running ? <button className="button light" type="button" onClick={pause}>暫停</button> : !done && remaining > 0 ? <button className="button light" type="button" onClick={resume}>繼續</button> : null}<button className="button light" type="button" onClick={reset}>重設</button></div>}
      <p className="timer-status" role={done ? "alert" : "status"}>{done ? "時間到！可以開始下一組了。" : running ? "倒數中，時間到會提醒你。" : "點選常用時間即可開始。"}</p>
      <div className="timer-sound">
        <button type="button" className="timer-sound-toggle" role="switch" aria-checked={soundOn} onClick={toggleSound}><span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>提示音{soundOn ? "開啟" : "關閉"}</button>
        {soundOn
          ? <button type="button" className="timer-sound-test" onClick={() => { unlockSound(); window.setTimeout(playDoneSound, 60); }}>試聽<small>聽不到請關閉手機側邊的靜音開關</small></button>
          : <small className="timer-sound-note">時間到時只會震動與顯示提醒。</small>}
      </div>
    </section>}

    <button type="button" className="rest-timer-fab" aria-expanded={open} aria-label={label} onClick={() => setOpen(value => !value)}>
      {running || done
        ? <output aria-live="off">{formatTime(remaining)}</output>
        : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5" /><path d="M12 10v3.5l2.2 1.6M9.4 2.5h5.2M12 2.5v3" /></svg>}
    </button>
  </div>;
}
