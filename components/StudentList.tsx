"use client";

import { useMemo, useState } from "react";
import { moveStudent } from "@/app/actions";

type Student = { id: string; name: string; email: string | null; weight: number | null };

export function StudentList({ students }: { students: Student[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-TW");
    if (!keyword) return students;
    return students.filter(student => student.name.toLocaleLowerCase("zh-TW").includes(keyword));
  }, [query, students]);

  return <>
    <div className="student-list-tools"><label className="student-search">搜尋學生姓名<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="輸入學生姓名" /></label>{!query.trim() && students.length > 1 && <p className="student-sort-help">使用箭頭調整常用學生順序</p>}</div>
    {filtered.length ? <div className="students">{filtered.map(student => { const position=students.findIndex(item=>item.id===student.id); return <article className="student" key={student.id}><a className="student-link" href={`/students/${student.id}`}><h3>{student.name}</h3><div className="muted">{student.email || "尚未填寫 Email"}</div><p>{student.weight ? `目前 ${student.weight} kg` : "尚無身體數據"}</p></a>{!query.trim() && students.length > 1 && <div className="student-order-controls" aria-label={`調整 ${student.name} 的順序`}><form action={moveStudent.bind(null,student.id,"up")}><button type="submit" className="student-order-button" disabled={position===0} aria-label={`${student.name} 上移`}>↑</button></form><form action={moveStudent.bind(null,student.id,"down")}><button type="submit" className="student-order-button" disabled={position===students.length-1} aria-label={`${student.name} 下移`}>↓</button></form></div>}</article>})}</div> : <div className="card empty">找不到符合「{query}」的學生。</div>}
  </>;
}
