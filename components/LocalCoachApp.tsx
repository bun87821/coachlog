"use client";

import { useEffect, useState } from "react";
import { emptyLocalData, loadLocalData, saveLocalData, uid, type LocalCoachData } from "@/lib/local-coach-data";
import { usePointerStudentOrder } from "@/components/usePointerStudentOrder";
import { LocalCalendar } from "@/components/LocalCalendar";
import { LocalStudentPage } from "@/components/LocalStudentPage";
import "./LocalCoachApp.css";

export function LocalCoachApp() {
  const [data, setData] = useState<LocalCoachData>(emptyLocalData);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [startAt, setStartAt] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  useEffect(() => { setData(loadLocalData()); setReady(true); }, []);
  const update = (next: LocalCoachData) => { setData(next); saveLocalData(next); };
  const sortable = usePointerStudentOrder(data.students.map(student => student.id), ids => {
    const students = ids.map(id => data.students.find(student => student.id === id)!).filter(Boolean);
    update({ ...data, students });
  });
  if (!ready) return <main className="shell"><p>載入本機資料中…</p></main>;
  const student = data.students.find(item => item.id === selected);
  if (student) return <LocalStudentPage data={data} studentId={student.id} partnerIds={partnerIds.filter(id => id !== student.id && data.students.some(item => item.id === id))} onPartnersChange={setPartnerIds} startAt={startAt} update={update} back={() => { setPartnerIds([]); setStartAt(undefined); setSelected(null); }} />;
  const filtered = sortable.order.map(id => data.students.find(item => item.id === id)!).filter(Boolean).filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

  return <main className="shell local-app">
    <nav className="topbar"><div className="brand">Coach<span>Log</span></div><div className="row"><span className="local-badge">本機模式</span><a className="button light" href="/">登入 Google 帳號</a></div></nav>
    <section className="card local-notice"><strong>資料儲存在這台裝置</strong><span>功能與雲端版相同，但不會同步 Google Calendar。請勿清除 Safari 網站資料。</span></section>
    <LocalCalendar students={data.students} bookings={data.bookings} onChange={bookings => update({ ...data, bookings })} onOpenBooking={(studentId, at) => { setPartnerIds([]); setStartAt(at); setSelected(studentId); }} />
    <div className="dashboard student-section"><section><div className="section-title"><div><div className="eyebrow">學生管理</div><h1>你的學生</h1></div></div><label className="student-search">搜尋學生姓名<input value={query} onChange={event => setQuery(event.target.value)} placeholder="輸入學生姓名" aria-label="搜尋學生姓名" /></label><p className="student-sort-help">按住 ☰ 拖曳即可調整順序</p>{filtered.length ? <div className="students local-students">{filtered.map(item => <article className="student" data-sort-id={item.id} key={item.id}><button className="local-student-link" onClick={() => { setPartnerIds([]); setStartAt(undefined); setSelected(item.id); }}><h3>{item.name}</h3><span className="muted">{item.email || "尚未填寫 Email"}</span><p>{item.metrics.at(-1)?.weight ? `目前 ${item.metrics.at(-1)?.weight} kg` : "尚無身體數據"}</p></button><button type="button" className="student-drag-handle" onPointerDown={event => sortable.start(item.id, event)} aria-label={`拖曳 ${item.name} 調整順序`}>☰</button></article>)}</div> : <div className="card empty">還沒有學生，從右側新增第一位。</div>}</section><aside><div className="card"><h2>新增學生</h2><form className="stack" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("name") || "").trim(); if (!name) return; update({ ...data, students: [...data.students, { id: uid(), name, email: String(form.get("email") || ""), phone: String(form.get("phone") || ""), notes: String(form.get("notes") || ""), metrics: [], sessions: [] }] }); event.currentTarget.reset(); }}><input name="name" placeholder="學生姓名" required /><input name="email" type="email" placeholder="Email（選填）" /><input name="phone" type="tel" inputMode="tel" placeholder="電話（選填）" /><textarea name="notes" placeholder="備註" /><button>建立學生</button></form></div></aside></div>
  </main>;
}
