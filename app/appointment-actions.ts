"use server";

import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { googleAccessToken } from "@/lib/google-calendar";
import { appointmentEventBody } from "@/lib/calendar-event";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const value = (entry: FormDataEntryValue | null) => String(entry || "").trim();
const eventsUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** 表單送出的學生，確認都屬於這位教練，並依表單順序取回姓名。 */
async function resolveStudents(formData: FormData, coachId: string) {
  const ids = [...new Set([value(formData.get("studentId")), ...formData.getAll("partnerId").map(value)].filter(Boolean))];
  if (!ids.length) throw new Error("請選擇學生");
  const found = await db.query(`SELECT id,name FROM students WHERE id = ANY($1::uuid[]) AND coach_id=$2`, [ids, coachId]);
  if (found.rows.length !== ids.length) throw new Error("找不到學生");
  return { ids, names: ids.map(id => found.rows.find((row: { id: string }) => String(row.id) === id)!.name as string) };
}

function appointmentFields(formData: FormData) {
  return {
    notes: value(formData.get("notes")),
    date: value(formData.get("date")),
    time: value(formData.get("time")),
    duration: Math.max(15, Math.min(240, Number(formData.get("duration")) || 60)),
    appUrl: process.env.AUTH_URL,
  };
}

export async function updateAppointment(formData: FormData) {
  const coach = await requireCoach();
  const eventId = value(formData.get("eventId"));
  if (!eventId) throw new Error("找不到這筆預約");
  const { ids, names } = await resolveStudents(formData, coach.id);
  const fields = appointmentFields(formData);
  const token = await googleAccessToken(coach.id);

  const existing = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!existing.ok) throw new Error("找不到這筆預約，請重新整理後再試");
  // 只允許改動 CoachLog 建立的課程，行事曆上的其他行程不受影響
  const event = await existing.json();
  if (!/student:[0-9a-f-]+/.test(event.description || "")) throw new Error("這不是 CoachLog 的課程預約");

  const response = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(appointmentEventBody({ studentIds: ids, names, ...fields })),
  });
  if (!response.ok) throw new Error("無法更新 Google Calendar 預約，請重新登入授權");

  revalidatePath("/dashboard");
  redirect(`/dashboard?date=${fields.date}#calendar`);
}

export async function deleteAppointment(formData: FormData) {
  const coach = await requireCoach();
  const eventId = value(formData.get("eventId"));
  const date = value(formData.get("date"));
  if (!eventId) throw new Error("找不到這筆預約");
  const token = await googleAccessToken(coach.id);

  const existing = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!existing.ok) throw new Error("找不到這筆預約，請重新整理後再試");
  const event = await existing.json();
  if (!/student:[0-9a-f-]+/.test(event.description || "")) throw new Error("這不是 CoachLog 的課程預約");

  const response = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  // 已經在 Google Calendar 端刪掉的事件回 410，視同成功
  if (!response.ok && response.status !== 410) throw new Error("無法取消 Google Calendar 預約，請重新登入授權");

  revalidatePath("/dashboard");
  redirect(`/dashboard?date=${date}#calendar`);
}
