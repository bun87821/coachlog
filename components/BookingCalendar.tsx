"use client";

import { useMemo, useState } from "react";
import { createAppointment } from "@/app/actions";

type Student = { id: string; name: string };
type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

const keyFor = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function BookingCalendar({ students, events }: { students: Student[]; events: CalendarEvent[] }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(keyFor(today));
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      const value = event.start?.dateTime || event.start?.date;
      if (!value) continue;
      const key = keyFor(value);
      (map[key] ||= []).push(event);
    }
    return map;
  }, [events]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells: Array<Date | null> = Array(first.getDay()).fill(null);
  for (let day = 1; day <= last.getDate(); day++) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  while (cells.length % 7) cells.push(null);
  const selectedEvents = eventsByDate[selectedDate] || [];
  const selectedLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });

  return <section className="calendar-layout">
    <div className="card calendar-card">
      <div className="calendar-head">
        <button className="icon-button" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
        <h2>{month.toLocaleDateString("zh-TW", { year: "numeric", month: "long" })}</h2>
        <button className="icon-button" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
      </div>
      <div className="calendar-grid weekdays">{["日", "一", "二", "三", "四", "五", "六"].map(day => <div key={day}>{day}</div>)}</div>
      <div className="calendar-grid">
        {cells.map((date, index) => {
          if (!date) return <div className="calendar-day blank" key={`blank-${index}`} />;
          const key = keyFor(date);
          const dayEvents = eventsByDate[key] || [];
          return <button type="button" key={key} onClick={() => setSelectedDate(key)} className={`calendar-day ${selectedDate === key ? "selected" : ""} ${key === keyFor(today) ? "today" : ""}`}>
            <span className="day-number">{date.getDate()}</span>
            {dayEvents.slice(0, 2).map(event => <span className="event-pill" key={event.id}>{event.summary || "預約"}</span>)}
            {dayEvents.length > 2 && <span className="more-events">+{dayEvents.length - 2} 筆</span>}
          </button>;
        })}
      </div>
    </div>
    <aside className="calendar-sidebar">
      <div className="card">
        <div className="eyebrow">當日預約</div>
        <h2>{selectedLabel}</h2>
        {selectedEvents.length ? selectedEvents.map(event => {
          const studentId = event.description?.match(/student:([0-9a-f-]+)/)?.[1];
          const start = event.start?.dateTime ? new Date(event.start.dateTime).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "全天";
          return <a className="booking-item" key={event.id} href={studentId ? `/students/${studentId}` : event.htmlLink} target={studentId ? undefined : "_blank"}>
            <time>{start}</time><strong>{event.summary || "未命名預約"}</strong>
          </a>;
        }) : <p className="muted">這天目前沒有預約。</p>}
      </div>
      <div className="card">
        <h2>新增學生預約</h2>
        {students.length ? <form className="stack" action={createAppointment}>
          <label>學生<select name="studentId" required defaultValue=""><option value="" disabled>選擇學生</option>{students.map(student => <option value={student.id} key={student.id}>{student.name}</option>)}</select></label>
          <label>日期<input name="date" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} required /></label>
          <div className="row"><label>開始時間<input name="time" type="time" defaultValue="10:00" required /></label><label>課程分鐘<input name="duration" type="number" min="15" step="15" defaultValue="60" required /></label></div>
          <textarea name="notes" placeholder="預約備註（選填）" />
          <button>加入 Google Calendar</button>
        </form> : <p className="muted">請先建立學生，再新增預約。</p>}
      </div>
    </aside>
  </section>;
}
