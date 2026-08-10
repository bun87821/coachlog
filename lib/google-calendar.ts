import { db } from "@/lib/db";

export async function googleAccessToken(coachId: string) {
  const result = await db.query(
    `SELECT google_access_token, google_refresh_token, token_expires_at FROM coaches WHERE id=$1`,
    [coachId],
  );
  const coach = result.rows[0];
  if (!coach) throw new Error("找不到教練帳號");

  const expiresAt = Number(coach.token_expires_at || 0) * 1000;
  if (coach.google_access_token && expiresAt > Date.now() + 60_000) {
    return coach.google_access_token as string;
  }
  if (!coach.google_refresh_token) throw new Error("請重新登入 Google 以授權行事曆");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID || "",
      client_secret: process.env.AUTH_GOOGLE_SECRET || "",
      refresh_token: coach.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Google 授權已失效，請重新登入");
  const tokens = await response.json();
  const nextExpiry = Math.floor(Date.now() / 1000) + Number(tokens.expires_in || 3600);
  await db.query(
    `UPDATE coaches SET google_access_token=$2, token_expires_at=$3 WHERE id=$1`,
    [coachId, tokens.access_token, nextExpiry],
  );
  return tokens.access_token as string;
}

export async function listCalendarEvents(coachId: string) {
  try {
    const token = await googleAccessToken(coachId);
    const min = new Date();
    min.setMonth(min.getMonth() - 3, 1);
    min.setHours(0, 0, 0, 0);
    const max = new Date();
    max.setMonth(max.getMonth() + 7, 0);
    max.setHours(23, 59, 59, 999);
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.search = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: min.toISOString(),
      timeMax: max.toISOString(),
      maxResults: "500",
    }).toString();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    return (await response.json()).items || [];
  } catch {
    return [];
  }
}
