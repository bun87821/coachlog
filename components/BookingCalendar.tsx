"use client";

import { useMemo, useState } from "react";
import { createAppointment } from "@/app/actions";
import { saveCalendarSettings } from "@/app/calendar-settings-actions";

type Student = { id: string; name: string };
type CalendarEvent = { id: string; summary?: string; description?: string; htmlLink?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };
type ViewMode = "month" | "week" | "day";
type Settings = { view: ViewMode; availability: { days: number[]; start: string; end: string }; duration: number };

const keyFor = (value: string | Date) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const dateFor = (key: string) => new Date(`${key}T12:00:00`);
const timeFor = (value?: string) => value ? new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "全天";
const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export function BookingCalendar({ students, events, settings }: { students: Student[]; events: CalendarEvent[]; settings: Settings }) {
  const today = new Date();
  const [view, setView] = useState<ViewMode>(settings.view);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(keyFor(today));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) { const value = event.start?.dateTime || event.start?.date; if (value) (map[keyFor(value)] ||= []).push(event); }
    return map;
  }, [events]);

  const slotsFor = (key: string) => {
    const date = dateFor(key);
    if (!settings.availability.days.includes(date.getDay())) return [];
    const booked = eventsByDate[key] || [];
    const slots: string[] = [];
    for (let start = minutes(settings.availability.start); start + settings.duration <= minutes(settings.availability.end); start += settings.duration) {
      const slotStart = new Date(`${key}T${clock(start)}:00`);
      const slotEnd = new Date(slotStart.getTime() + settings.duration * 60000);
      const conflict = booked.some(event => event.start?.dateTime && event.end?.dateTime && new Date(event.start.dateTime) < slotEnd && new Date(event.end.dateTime) > slotStart);
      if (!conflict) slots.push(clock(start));
    }
    return slots;
  };

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells: Array<Date | null> = Array(first.getDay()).fill(null);
  for (let day = 1; day <= last.getDate(); day++) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  while (cells.length % 7) cells.push(null);
  const selectedEvents = eventsByDate[selectedDate] || [];
  const availableSlots = slotsFor(selectedDate);
  const selected = dateFor(selectedDate);
  const monday = new Date(selected); monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, index) => { const value = new Date(monday); value.setDate(monday.getDate() + index); return value; });
  const dayStrip = Array.from({ length: 7 }, (_, index) => { const value = new Date(selected); value.setDate(selected.getDate() + index - 3); return value; });
  const visibleDates = view === "week" ? weekDates : dayStrip;
  const selectedLabel = selected.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

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
        const status = slots.length ? `${slots.length} 空位` : settings.availability.days.includes(date.getDay()) ? "已滿" : "休息";
        return <button type="button" className={`compact-day ${selectedDate === key ? "selected" : ""}`} onClick={() => setSelectedDate(key)} key={key}><strong>{date.getDate()}</strong><small className={slots.length > 2 ? "available" : slots.length ? "limited" : "full"}>{status}</small>{booked > 0 && <span>{booked} 堂</span>}</button>;
      })}</div>
      <div className="availability-legend"><span><i className="available" />可預約</span><span><i className="limited" />少量時段</span><span><i className="full" />已滿／休息</span></div>
    </div> : <div className="date-strip">{visibleDates.map(date => { const key = keyFor(date); const slots = slotsFor(key); return <button type="button" className={key === selectedDate ? "selected" : ""} onClick={() => setSelectedDate(key)} key={key}><span>{["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}</span><strong>{date.getDate()}</strong><small>{slots.length ? `${slots.length} 空位` : "已滿"}</small></button>; })}</div>}

    <div className="selected-day-head"><div><h2>{selectedLabel}</h2><p>{selectedEvents.length} 堂預約・{availableSlots.length} 個時段可預約</p></div><button className="button" type="button" onClick={() => document.getElementById("appointment-form")?.scrollIntoView({ behavior: "smooth" })}>＋ 新增學生預約</button></div>

    <div className="day-schedule">
      <section><h3>已預約</h3>{selectedEvents.length ? selectedEvents.map(event => { const studentId = event.description?.match(/student:([0-9a-f-]+)/)?.[1]; return <a className="schedule-row booked" key={event.id} href={studentId ? `/students/${studentId}` : event.htmlLink} target={studentId ? undefined : "_blank"}><time>{timeFor(event.start?.dateTime)}</time><strong>{event.summary || "未命名預約"}</strong><span>{event.end?.dateTime ? `${timeFor(event.end.dateTime)} 結束` : "全天"}</span></a>; }) : <p className="muted">這天目前沒有預約。</p>}</section>
      <section><h3>可預約時段</h3>{availableSlots.length ? <div className="slot-list">{availableSlots.map(slot => <button type="button" onClick={() => { const input = document.querySelector<HTMLInputElement>('#appointment-form input[name="time"]'); if (input) input.value = slot; document.getElementById("appointment-form")?.scrollIntoView({ behavior: "smooth" }); }} key={slot}>{slot}<small>{settings.duration} 分鐘</small></button>)}</div> : <p className="muted">這天沒有可預約時段。</p>}</section>
    </div>

    <button className="calendar-settings-toggle" type="button" onClick={() => setSettingsOpen(open => !open)} aria-expanded={settingsOpen}>行事曆設定：預設{{ month: "月", week: "週", day: "日" }[settings.view]}檢視・每堂 {settings.duration} 分鐘</button>
    {settingsOpen && <form className="card calendar-settings" action={saveCalendarSettings}><h3>行事曆設定</h3><label>預設檢視<select name="view" defaultValue={settings.view}><option value="month">月</option><option value="week">週</option><option value="day">日</option></select></label><fieldset><legend>每週可授課日</legend>{["日", "一", "二", "三", "四", "五", "六"].map((label, day) => <label key={day}><input type="checkbox" name="days" value={day} defaultChecked={settings.availability.days.includes(day)} />{label}</label>)}</fieldset><div className="row"><label>開始時間<input type="time" name="start" defaultValue={settings.availability.start} /></label><label>結束時間<input type="time" name="end" defaultValue={settings.availability.end} /></label></div><label>每堂課長度（分鐘）<input type="number" name="duration" min="15" step="15" defaultValue={settings.duration} /></label><button>儲存行事曆設定</button></form>}

    <div className="card appointment-card" id="appointment-form"><h2>新增學生預約</h2>{students.length ? <form className="stack" action={createAppointment}><label>學生<select name="studentId" required defaultValue=""><option value="" disabled>選擇學生</option>{students.map(student => <option value={student.id} key={student.id}>{student.name}</option>)}</select></label><label>日期<input name="date" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} required /></label><div className="row"><label>開始時間<input name="time" type="time" defaultValue={availableSlots[0] || "10:00"} required /></label><label>課程分鐘<input name="duration" type="number" min="15" step="15" defaultValue={settings.duration} required /></label></div><textarea name="notes" placeholder="預約備註（選填）" /><button>加入 Google Calendar</button></form> : <p className="muted">請先建立學生，再新增預約。</p>}</div>
  </section>;
}
