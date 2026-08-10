"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createAppointment } from "@/app/actions";
import { saveCalendarSettings } from "@/app/calendar-settings-actions";
import { createAvailabilityBlock, removeAvailabilityBlock } from "@/app/calendar-block-actions";
import "./CalendarSettings.css";

type Student = { id: string; name: string };
type CalendarEvent = { id: string; summary?: string; description?: string; htmlLink?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };
type ViewMode = "month" | "week" | "day";
type Period = { start: string; end: string };
type Availability = { days?: number[]; start?: string; end?: string; periods?: Record<string, Period[]> };
type Settings = { view: ViewMode; availability: Availability; duration: number };
type AvailabilityBlock = { id: string; date: string; time: string; duration: number; kind: "break" | "unavailable" };

const keyFor = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const dateFor = (key: string) => new Date(`${key}T12:00:00`);
const timeFor = (value?: string) => value ? new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" }) : "全天";
const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

function SaveSettingsButton({ invalid }: { invalid: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={invalid || pending} aria-busy={pending}>{pending ? "儲存中…" : "儲存行事曆設定"}</button>;
}

export function BookingCalendar({ students, events, settings, blocks, initialDate }: { students: Student[]; events: CalendarEvent[]; settings: Settings; blocks: AvailabilityBlock[]; initialDate?: string }) {
  const today = new Date();
  const [view, setView] = useState<ViewMode>(settings.view);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(initialDate || keyFor(today));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingBlock, setPendingBlock] = useState<string | null>(null);
  const legacyDays = settings.availability.days || [];
  const initialPeriods = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, settings.availability.periods?.[day] || (legacyDays.includes(day) ? [{ start: settings.availability.start || "07:00", end: settings.availability.end || "21:00" }] : [])])) as Record<number, Period[]>;
  const [availabilityPeriods, setAvailabilityPeriods] = useState<Record<number, Period[]>>(initialPeriods);
  const [settingsDay, setSettingsDay] = useState(today.getDay());
  const holdTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) { const value = event.start?.dateTime || event.start?.date; if (value) (map[keyFor(value)] ||= []).push(event); }
    return map;
  }, [events]);

  const slotsFor = (key: string) => {
    const date = dateFor(key);
    const periods = availabilityPeriods[date.getDay()] || [];
    if (!periods.length) return [];
    const booked = eventsByDate[key] || [];
    const dayBlocks = blocks.filter(block => block.date === key);
    const slots = new Set<string>();
    for (const period of periods) for (let start = minutes(period.start); start + settings.duration <= minutes(period.end); start += settings.duration) {
      const slotStart = new Date(`${key}T${clock(start)}:00`);
      const slotEnd = new Date(slotStart.getTime() + settings.duration * 60000);
      const conflict = booked.some(event => event.start?.dateTime && event.end?.dateTime && new Date(event.start.dateTime) < slotEnd && new Date(event.end.dateTime) > slotStart) || dayBlocks.some(block => minutes(block.time.slice(0, 5)) < start + settings.duration && minutes(block.time.slice(0, 5)) + block.duration > start);
      if (!conflict) slots.add(clock(start));
    }
    return [...slots].sort();
  };

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells: Array<Date | null> = Array(first.getDay()).fill(null);
  for (let day = 1; day <= last.getDate(); day++) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  while (cells.length % 7) cells.push(null);
  const selectedEvents = eventsByDate[selectedDate] || [];
  const selectedBlocks = blocks.filter(block => block.date === selectedDate);
  const availableSlots = slotsFor(selectedDate);
  const selected = dateFor(selectedDate);
  const monday = new Date(selected); monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, index) => { const value = new Date(monday); value.setDate(monday.getDate() + index); return value; });
  const dayStrip = Array.from({ length: 7 }, (_, index) => { const value = new Date(selected); value.setDate(selected.getDate() + index - 3); return value; });
  const visibleDates = view === "week" ? weekDates : dayStrip;
  const selectedLabel = selected.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
  const totalPeriodCount = Object.values(availabilityPeriods).reduce((total, periods) => total + periods.length, 0);
  const activeDayCount = Object.values(availabilityPeriods).filter(periods => periods.length > 0).length;
  const invalidDay = Object.entries(availabilityPeriods).find(([, periods]) => periods.some((period, index) => period.start >= period.end || periods.some((other, otherIndex) => index !== otherIndex && period.start < other.end && period.end > other.start)))?.[0];
  const availabilityError = invalidDay === undefined ? "" : `週${weekdayLabels[Number(invalidDay)]}的時段重疊，或結束時間早於開始時間。`;
  const addPeriod = (day: number) => setAvailabilityPeriods(current => {
    const periods = current[day] || [];
    const lastEnd = periods.map(period => period.end).sort().at(-1) || "09:00";
    const startMinutes = Math.min(minutes(lastEnd), 22 * 60);
    const endMinutes = Math.min(startMinutes + 180, 23 * 60 + 59);
    return { ...current, [day]: [...periods, { start: clock(startMinutes), end: clock(endMinutes) }] };
  });

  return <section className="calendar-v2">
    <div className="calendar-toolbar">
      <div><div className="eyebrow">預約管理</div><h2>{view === "month" ? month.toLocaleDateString("zh-TW", { year: "numeric", month: "long" }) : selectedLabel}</h2></div>
      <div className="calendar-view-switch" aria-label="行事曆顯示模式">{(["month", "week", "day"] as ViewMode[]).map(mode => <button type="button" className={view === mode ? "active" : ""} aria-pressed={view === mode} onClick={() => setView(mode)} key={mode}>{{ month: "月", week: "週", day: "日" }[mode]}</button>)}</div>
    </div>

    {view === "month" ? <div className="compact-month">
      <div className="month-controls"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>上個月</button><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>下個月</button></div>
      <div className="calendar-grid weekdays">{["日", "一", "二", "三", "四", "五", "六"].map(day => <div key={day}>{day}</div>)}</div>
      <div className="calendar-grid">{cells.map((date, index) => {
        if (!date) return <div className="compact-day blank" key={`blank-${index}`} />;
        const key = keyFor(date); const slots = slotsFor(key); const booked = (eventsByDate[key] || []).length;
        const status = slots.length ? `${slots.length} 空位` : availabilityPeriods[date.getDay()]?.length ? "已滿" : "休息";
        return <button type="button" className={`compact-day ${selectedDate === key ? "selected" : ""}`} onClick={() => setSelectedDate(key)} key={key}><strong>{date.getDate()}</strong><small className={slots.length > 2 ? "available" : slots.length ? "limited" : "full"}>{status}</small>{booked > 0 && <span>{booked} 堂</span>}</button>;
      })}</div>
      <div className="availability-legend"><span><i className="available" />可預約</span><span><i className="limited" />少量時段</span><span><i className="full" />已滿／休息</span></div>
    </div> : <div className="date-strip">{visibleDates.map(date => { const key = keyFor(date); const slots = slotsFor(key); return <button type="button" className={key === selectedDate ? "selected" : ""} onClick={() => setSelectedDate(key)} key={key}><span>{["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}</span><strong>{date.getDate()}</strong><small>{slots.length ? `${slots.length} 空位` : "已滿"}</small></button>; })}</div>}

    <div className="selected-day-head"><div><h2>{selectedLabel}</h2><p>{selectedEvents.length} 堂預約・{availableSlots.length} 個時段可預約</p></div><button className="button" type="button" onClick={() => document.getElementById("appointment-form")?.scrollIntoView({ behavior: "smooth" })}>＋ 新增學生預約</button></div>

    <div className="day-schedule">
      <section><h3>已預約</h3>{selectedEvents.length ? selectedEvents.map(event => { const studentId = event.description?.match(/student:([0-9a-f-]+)/)?.[1]; return <a className="schedule-row booked" key={event.id} href={studentId ? `/students/${studentId}` : event.htmlLink} target={studentId ? undefined : "_blank"}><time>{timeFor(event.start?.dateTime)}</time><strong>{event.summary || "未命名預約"}</strong><span>{event.end?.dateTime ? `${timeFor(event.end.dateTime)} 結束` : "全天"}</span></a>; }) : <p className="muted">這天目前沒有預約。</p>}</section>
      <section><h3>可預約時段</h3><p className="slot-help">點一下新增預約；手機長按、桌機雙擊可設定休息或不可預約。</p>{availableSlots.length ? <div className="slot-list">{availableSlots.map(slot => <button type="button" onDoubleClick={() => setPendingBlock(slot)} onPointerDown={() => { longPressed.current = false; holdTimer.current = window.setTimeout(() => { longPressed.current = true; setPendingBlock(slot); }, 600); }} onPointerUp={() => { if (holdTimer.current) window.clearTimeout(holdTimer.current); }} onPointerCancel={() => { if (holdTimer.current) window.clearTimeout(holdTimer.current); }} onPointerLeave={() => { if (holdTimer.current) window.clearTimeout(holdTimer.current); }} onClick={() => { if (longPressed.current) { longPressed.current = false; return; } const input = document.querySelector<HTMLInputElement>('#appointment-form input[name="time"]'); if (input) input.value = slot; document.getElementById("appointment-form")?.scrollIntoView({ behavior: "smooth" }); }} key={slot}>{slot}<small>{settings.duration} 分鐘・長按設定</small></button>)}</div> : <p className="muted">這天沒有可預約時段。</p>}{selectedBlocks.length > 0 && <div className="blocked-slots"><h4>休息／不可預約</h4>{selectedBlocks.map(block => <form action={removeAvailabilityBlock} key={block.id}><input type="hidden" name="id" value={block.id} /><input type="hidden" name="date" value={selectedDate} /><span><strong>{block.time.slice(0, 5)}</strong>　{block.kind === "break" ? "休息" : "不可預約"}</span><button type="submit">解除</button></form>)}</div>}</section>
    </div>

    <button className="calendar-settings-toggle" type="button" onClick={() => setSettingsOpen(open => !open)} aria-expanded={settingsOpen}>行事曆設定：預設{{ month: "月", week: "週", day: "日" }[settings.view]}檢視・每堂 {settings.duration} 分鐘</button>
    {settingsOpen && <form className="card calendar-settings" action={saveCalendarSettings}><div className="settings-heading"><div><span className="settings-kicker">排程偏好</span><h3>行事曆設定</h3><p>設定每週固定開放時段，臨時休息則直接在上方空位長按。</p></div><button className="settings-close" type="button" onClick={() => setSettingsOpen(false)}>收起設定</button></div><div className="settings-basics"><label>預設檢視<select name="view" defaultValue={settings.view}><option value="month">月檢視</option><option value="week">週檢視</option><option value="day">日檢視</option></select></label><label>每堂課長度<input type="number" name="duration" min="15" step="15" defaultValue={settings.duration} /><small>分鐘</small></label></div><input type="hidden" name="availability" value={JSON.stringify(availabilityPeriods)} /><section className="weekly-periods" aria-labelledby="availability-title"><div className="periods-heading"><div><h4 id="availability-title">每週可預約時間</h4><p>已設定 {activeDayCount} 天，共 {totalPeriodCount} 個時段</p></div><span>選擇星期後編輯</span></div><div className="weekday-tabs" role="tablist" aria-label="選擇要設定的星期">{weekdayLabels.map((label, day) => <button type="button" role="tab" aria-selected={settingsDay === day} className={settingsDay === day ? "active" : ""} onClick={() => setSettingsDay(day)} key={day}><strong>週{label}</strong><small>{availabilityPeriods[day]?.length ? `${availabilityPeriods[day].length} 段` : "休息"}</small></button>)}</div><div className="selected-weekday" role="tabpanel"><div className="selected-weekday-head"><div><h4>週{weekdayLabels[settingsDay]}</h4><p>{availabilityPeriods[settingsDay]?.length ? "學生只會看到以下時段可預約。" : "目前設定為休息，不會顯示可預約時段。"}</p></div>{availabilityPeriods[settingsDay]?.length > 0 && <button className="day-off-button" type="button" onClick={() => setAvailabilityPeriods(current => ({ ...current, [settingsDay]: [] }))}>設為休息日</button>}</div><div className="period-list">{(availabilityPeriods[settingsDay] || []).map((period, index) => <div className="period-card" key={`${settingsDay}-${index}`}><span className="period-number">時段 {index + 1}</span><label><span>開始</span><input type="time" value={period.start} onChange={event => setAvailabilityPeriods(current => ({ ...current, [settingsDay]: (current[settingsDay] || []).map((item, itemIndex) => itemIndex === index ? { ...item, start: event.target.value } : item) }))} /></label><span className="period-arrow" aria-hidden="true">→</span><label><span>結束</span><input type="time" value={period.end} onChange={event => setAvailabilityPeriods(current => ({ ...current, [settingsDay]: (current[settingsDay] || []).map((item, itemIndex) => itemIndex === index ? { ...item, end: event.target.value } : item) }))} /></label><button className="remove-period" type="button" aria-label={`移除週${weekdayLabels[settingsDay]}第 ${index + 1} 段`} onClick={() => setAvailabilityPeriods(current => ({ ...current, [settingsDay]: (current[settingsDay] || []).filter((_, itemIndex) => itemIndex !== index) }))}>移除</button></div>)}<button className="add-period" type="button" onClick={() => addPeriod(settingsDay)}>＋ 新增一個時段</button></div></div>{availabilityError && <p className="settings-error" role="alert">{availabilityError}</p>}</section><div className="settings-actions"><button className="button light" type="button" onClick={() => setSettingsOpen(false)}>取消</button><SaveSettingsButton invalid={Boolean(availabilityError)} /></div></form>}

    <div className="card appointment-card" id="appointment-form"><h2>新增學生預約</h2>{students.length ? <form className="stack" action={createAppointment}><label>學生<select name="studentId" required defaultValue=""><option value="" disabled>選擇學生</option>{students.map(student => <option value={student.id} key={student.id}>{student.name}</option>)}</select></label><label>日期<input name="date" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} required /></label><div className="row"><label>開始時間<input name="time" type="time" defaultValue={availableSlots[0] || "10:00"} required /></label><label>課程分鐘<input name="duration" type="number" min="15" step="15" defaultValue={settings.duration} required /></label></div><textarea name="notes" placeholder="預約備註（選填）" /><button>加入 Google Calendar</button></form> : <p className="muted">請先建立學生，再新增預約。</p>}</div>
    {pendingBlock && <div className="block-dialog-backdrop" role="presentation" onClick={() => setPendingBlock(null)}><div className="block-dialog" role="dialog" aria-modal="true" aria-labelledby="block-dialog-title" onClick={event => event.stopPropagation()}><h3 id="block-dialog-title">設定 {pendingBlock} 時段</h3><p>這個時段要標記成什麼？</p><div className="block-actions"><form action={createAvailabilityBlock}><input type="hidden" name="date" value={selectedDate} /><input type="hidden" name="time" value={pendingBlock} /><input type="hidden" name="duration" value={settings.duration} /><input type="hidden" name="kind" value="break" /><button>休息</button></form><form action={createAvailabilityBlock}><input type="hidden" name="date" value={selectedDate} /><input type="hidden" name="time" value={pendingBlock} /><input type="hidden" name="duration" value={settings.duration} /><input type="hidden" name="kind" value="unavailable" /><button>不可預約</button></form></div><button className="button light" type="button" onClick={() => setPendingBlock(null)}>取消</button></div></div>}
  </section>;
}
