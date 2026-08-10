export const workoutCsvHeaders = ["課堂識別碼", "上課時間", "課堂備註", "動作名稱", "組次", "次數", "重量", "單位"] as const;

const escapeCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const stringifyCsv = (rows: unknown[][]) => `\uFEFF${rows.map(row => row.map(escapeCell).join(",")).join("\r\n")}\r\n`;

export function parseCsv(source: string) {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); if (row.some(value => value !== "")) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) throw new Error("CSV 有未關閉的雙引號");
  if (cell !== "" || row.length) { row.push(cell.replace(/\r$/, "")); if (row.some(value => value !== "")) rows.push(row); }
  return rows;
}

export const formatTaipeiDateTime = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
};
