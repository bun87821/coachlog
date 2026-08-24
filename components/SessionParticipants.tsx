"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TrainingParticipant } from "@/lib/training-form-state";

export function SessionParticipants({ student, partners, candidates }: { student: TrainingParticipant; partners: TrainingParticipant[]; candidates: TrainingParticipant[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  const applyPartners = (ids: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (ids.length) params.set("with", ids.join(","));
    else params.delete("with");
    setPicking(false);
    setQuery("");
    router.replace(`/students/${student.id}${params.toString() ? `?${params}` : ""}#new-workout`);
  };

  const keyword = query.trim().toLocaleLowerCase("zh-TW");
  const selectable = candidates.filter(candidate => !keyword || candidate.name.toLocaleLowerCase("zh-TW").includes(keyword));

  return <div className="session-participants">
    <div className="participant-list">
      <span className="participant-chip owner">{student.name}</span>
      {partners.map(partner => <span className="participant-chip included" key={partner.id}>
        {partner.name}
        <button type="button" aria-label={`移除 ${partner.name}`} onClick={() => applyPartners(partners.filter(item => item.id !== partner.id).map(item => item.id))}>×</button>
      </span>)}
      {candidates.length > 0 && <button type="button" className="participant-chip add" onClick={() => setPicking(value => !value)} aria-expanded={picking}>＋ 一起上課的學生</button>}
      {partners.length > 0 && <span className="group-badge">一對{partners.length + 1}</span>}
    </div>

    {picking && <div className="participant-picker">
      <label className="participant-search">搜尋學生姓名<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="輸入學生姓名" /></label>
      {selectable.length ? <ul>
        {selectable.map(candidate => {
          const included = partners.some(partner => partner.id === candidate.id);
          return <li key={candidate.id}>
            <button
              type="button"
              className={included ? "included" : ""}
              aria-pressed={included}
              onClick={() => applyPartners(included ? partners.filter(item => item.id !== candidate.id).map(item => item.id) : [...partners.map(item => item.id), candidate.id])}
            >{candidate.name}</button>
          </li>;
        })}
      </ul> : <p className="muted">找不到符合的學生。</p>}
    </div>}
  </div>;
}
