"use server";

import { db } from "@/lib/db";
import { requireCoach } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const value = (entry: FormDataEntryValue | null) => String(entry || "").trim();

export async function createAvailabilityBlock(formData: FormData) {
  const coach = await requireCoach();
  const date = value(formData.get("date"));
  const time = value(formData.get("time"));
  const duration = Math.max(15, Math.min(240, Number(formData.get("duration")) || 60));
  const kind = value(formData.get("kind")) === "break" ? "break" : "unavailable";
  await db.query(`INSERT INTO availability_blocks(coach_id,blocked_date,start_time,duration,kind) VALUES($1,$2,$3,$4,$5) ON CONFLICT(coach_id,blocked_date,start_time) DO UPDATE SET duration=EXCLUDED.duration,kind=EXCLUDED.kind`, [coach.id, date, time, duration, kind]);
  revalidatePath("/dashboard");
  redirect(`/dashboard?date=${date}#calendar`);
}

export async function removeAvailabilityBlock(formData: FormData) {
  const coach = await requireCoach();
  const id = value(formData.get("id"));
  const date = value(formData.get("date"));
  await db.query(`DELETE FROM availability_blocks WHERE id=$1 AND coach_id=$2`, [id, coach.id]);
  revalidatePath("/dashboard");
  redirect(`/dashboard?date=${date}#calendar`);
}
