"use client";

import { useMemo, useState } from "react";

type Student = { id: string; name: string; email: string | null; weight: number | null };

export function StudentList({ students }: { students: Student[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-TW");
    if (!keyword) return students;
    return students.filter(student => student.name.toLocaleLowerCase("zh-TW").includes(keyword));
  }, [query, students]);

  return <>
    <label className="student-search">搜尋學生姓名<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="輸入學生姓名" /></label>
    {filtered.length ? <div className="students">{filtered.map(student => <a className="student" key={student.id} href={`/students/${student.id}`}><h3>{student.name}</h3><div className="muted">{student.email || "尚未填寫 Email"}</div><p>{student.weight ? `目前 ${student.weight} kg` : "尚無身體數據"}</p></a>)}</div> : <div className="card empty">找不到符合「{query}」的學生。</div>}
  </>;
}
