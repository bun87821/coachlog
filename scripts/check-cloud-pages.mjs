/**
 * 實際登入後載入雲端頁面，抓 build 與型別檢查都抓不到的執行期錯誤
 * （例如把事件處理函式傳進 server component）。
 *
 * 需要 CHECK_DATABASE_URL 才會執行，沒有設定就跳過。
 *   CHECK_DATABASE_URL=postgresql://... node scripts/check-cloud-pages.mjs
 */
import { spawn } from "node:child_process";
import pg from "pg";
import { encode } from "next-auth/jwt";

const url = process.env.CHECK_DATABASE_URL;
if (!url) {
  console.log("SKIP: 未設定 CHECK_DATABASE_URL，略過雲端頁面檢查");
  process.exit(0);
}

const port = Number(process.env.CHECK_PORT || 3399);
const secret = "check-cloud-pages-secret-000000000000000";
const db = new pg.Pool({ connectionString: url });
const coachId = `check-${Date.now()}`;

const seed = async () => {
  await db.query(`INSERT INTO coaches(id,email,name) VALUES($1,$2,'檢查用教練')`, [coachId, `${coachId}@example.test`]);
  const student = (await db.query(`INSERT INTO students(coach_id,name) VALUES($1,'檢查用學生') RETURNING id`, [coachId])).rows[0].id;
  const partner = (await db.query(`INSERT INTO students(coach_id,name) VALUES($1,'檢查用同伴') RETURNING id`, [coachId])).rows[0].id;
  const exercise = (await db.query(`INSERT INTO exercises(coach_id,name) VALUES($1,'檢查用動作') ON CONFLICT(coach_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [coachId])).rows[0].id;
  const groupId = crypto.randomUUID();
  for (const id of [student, partner]) {
    const session = (await db.query(`INSERT INTO sessions(student_id,occurred_at,notes,group_id) VALUES($1,now(),'檢查',$2) RETURNING id`, [id, groupId])).rows[0].id;
    await db.query(`INSERT INTO exercise_sets(session_id,exercise_id,set_number,reps,weight,unit) VALUES($1,$2,1,10,60,'kg')`, [session, exercise]);
  }
  await db.query(`INSERT INTO body_metrics(student_id,measured_at,weight) VALUES($1,CURRENT_DATE,70)`, [student]);
  return { student, partner };
};

const cleanup = async () => {
  await db.query(`DELETE FROM coaches WHERE id=$1`, [coachId]).catch(() => {});
  await db.end().catch(() => {});
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("伺服器沒有在時限內啟動");
};

const { student, partner } = await seed();
const server = spawn("npx", ["next", "dev", "-p", String(port)], {
  env: { ...process.env, DATABASE_URL: url, AUTH_SECRET: secret, AUTH_URL: `http://127.0.0.1:${port}`, AUTH_TRUST_HOST: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk; });
server.stderr.on("data", chunk => { serverOutput += chunk; });

const failures = [];
try {
  await waitForServer();
  const token = await encode({ token: { id: coachId, name: "檢查用教練", email: `${coachId}@example.test`, sub: coachId }, secret, salt: "authjs.session-token" });
  const pages = [
    ["首頁", "/"],
    ["學生列表與日曆", "/dashboard"],
    ["學生頁", `/students/${student}`],
    ["學生頁（一對二）", `/students/${student}?with=${partner}`],
    ["學生頁（日曆帶入時間）", `/students/${student}?at=2026-08-24T19:00`],
    ["學生頁（CSV 匯入結果）", `/students/${student}?csvError=${encodeURIComponent("測試訊息")}`],
    ["訓練紀錄 CSV", `/api/students/${student}/workouts.csv`],
    ["CSV 範本", "/api/workouts/template.csv"],
  ];
  for (const [label, path] of pages) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { Cookie: `authjs.session-token=${token}` }, redirect: "manual" });
    const ok = response.status < 400;
    console.log(`${ok ? "PASS" : "FAIL"}: ${label} → ${response.status}`);
    if (!ok) failures.push(`${label} (${path}) 回應 ${response.status}`);
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  server.kill("SIGTERM");
  await cleanup();
}

if (failures.length) {
  const errors = serverOutput.split("\n").filter(line => line.includes("Error") || line.startsWith("⨯")).slice(0, 12);
  console.error(`\n${failures.map(failure => `FAIL: ${failure}`).join("\n")}`);
  if (errors.length) console.error(`\n伺服器錯誤：\n${errors.join("\n")}`);
  process.exit(1);
}
console.log("PASS: 雲端頁面在登入後都能正常載入");
