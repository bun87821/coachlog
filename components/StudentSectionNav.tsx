"use client";

import { useEffect, useState } from "react";

export type StudentSection = { id: string; label: string };

export const studentSections: StudentSection[] = [
  { id: "student-overview", label: "學生資料" },
  { id: "progress", label: "進步趨勢" },
  { id: "new-workout", label: "新增訓練" },
  { id: "body-metrics", label: "身體數據" },
  { id: "history", label: "歷史紀錄" },
];

export function StudentSectionNav({ trailing }: { trailing: React.ReactNode }) {
  const [active, setActive] = useState(studentSections[0].id);

  useEffect(() => {
    let frame = 0;
    const pick = () => {
      frame = 0;
      const offset = 132;
      let current = studentSections[0].id;
      for (const section of studentSections) {
        const target = document.getElementById(section.id);
        if (target && target.getBoundingClientRect().top <= offset) current = section.id;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 8) current = studentSections[studentSections.length - 1].id;
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(pick); };
    pick();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    document.querySelector(`.student-quick-nav a[aria-current="true"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return <aside className="student-quick-nav" aria-label="學生頁快速導覽">
    <strong>快速前往</strong>
    <nav>
      {studentSections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={section.id === active ? "true" : undefined}>{section.label}</a>)}
      {trailing}
    </nav>
  </aside>;
}
