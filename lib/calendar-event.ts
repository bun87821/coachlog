export type AppointmentDetails = {
  studentIds: string[];
  names: string[];
  notes: string;
  date: string;
  time: string;
  duration: number;
  appUrl?: string;
};

export const appointmentStart = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`);

/** 建立與修改預約共用同一份內容，避免改過之後格式跟建立時不一致。 */
export function appointmentEventBody({ studentIds, names, notes, date, time, duration, appUrl }: AppointmentDetails) {
  const start = appointmentStart(date, time);
  const end = new Date(start.getTime() + duration * 60_000);
  const link = `${appUrl || ""}/students/${studentIds[0]}${studentIds.length > 1 ? `?with=${studentIds.slice(1).join(",")}` : ""}`;
  return {
    summary: `${names.join("、")}｜私人教練課`,
    description: `${studentIds.map(id => `student:${id}`).join("\n")}\nCoachLog: ${link}\n${notes}`,
    start: { dateTime: start.toISOString(), timeZone: "Asia/Taipei" },
    end: { dateTime: end.toISOString(), timeZone: "Asia/Taipei" },
  };
}

/** 從行事曆事件的描述取出這堂課的學生。 */
export const studentIdsFromDescription = (description?: string) =>
  [...(description?.matchAll(/student:([0-9a-f-]+)/g) || [])].map(match => match[1]);

/** 依事件起訖推回課程分鐘數，供修改表單帶入預設值。 */
export function appointmentDuration(start?: string, end?: string, fallback = 60) {
  if (!start || !end) return fallback;
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  return minutes > 0 ? minutes : fallback;
}
