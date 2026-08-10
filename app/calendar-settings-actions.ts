"use server";

import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveCalendarSettings(formData: FormData) {
  const coach = await requireCoach();
  const view = ["month", "week", "day"].includes(String(formData.get("view"))) ? String(formData.get("view")) : "month";
  const days = formData.getAll("days").map(Number).filter(day => day >= 0 && day <= 6);
  const start = String(formData.get("start") || "07:00");
  const end = String(formData.get("end") || "21:00");
  const duration = Math.max(15, Math.min(240, Number(formData.get("duration")) || 60));
  await db.query(`UPDATE coaches SET calendar_view=$2,availability=$3::jsonb,default_duration=$4 WHERE id=$1`, [coach.id, view, JSON.stringify({ days, start, end }), duration]);
  revalidatePath("/dashboard");
  redirect("/dashboard#calendar");
}
