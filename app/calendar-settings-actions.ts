"use server";

import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveCalendarSettings(formData: FormData) {
  const coach = await requireCoach();
  const view = ["month", "week", "day"].includes(String(formData.get("view"))) ? String(formData.get("view")) : "month";
  let periods: Record<string, Array<{ start: string; end: string }>> = {};
  try {
    const submitted = JSON.parse(String(formData.get("availability") || "{}")) as Record<string, Array<{ start?: unknown; end?: unknown }>>;
    const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    periods = Object.fromEntries(Array.from({ length: 7 }, (_, day) => {
      const valid = Array.isArray(submitted[day]) ? submitted[day].filter(item => validTime(item.start) && validTime(item.end) && String(item.start) < String(item.end)).map(item => ({ start: String(item.start), end: String(item.end) })).sort((a, b) => a.start.localeCompare(b.start)) : [];
      return [day, valid];
    }));
  } catch {}
  const duration = Math.max(15, Math.min(240, Number(formData.get("duration")) || 60));
  await db.query(`UPDATE coaches SET calendar_view=$2,availability=$3::jsonb,default_duration=$4 WHERE id=$1`, [coach.id, view, JSON.stringify({ periods }), duration]);
  revalidatePath("/dashboard");
  redirect("/dashboard#calendar");
}
