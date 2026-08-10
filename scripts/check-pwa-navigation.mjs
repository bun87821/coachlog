import fs from "node:fs";

const manifestUrl = new URL("../app/manifest.ts", import.meta.url);
const manifest = fs.existsSync(manifestUrl) ? fs.readFileSync(manifestUrl, "utf8") : "";
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const studentList = fs.readFileSync(new URL("../components/StudentList.tsx", import.meta.url), "utf8");

const checks = [
  [manifest.includes('start_url: "/dashboard"'), "manifest 必須從 /dashboard 啟動"],
  [manifest.includes('scope: "/"'), "manifest scope 必須涵蓋學生頁"],
  [manifest.includes('display: "standalone"'), "manifest 必須使用 standalone 顯示"],
  [layout.includes("appleWebApp"), "layout 必須宣告 iPhone 主畫面模式"],
  [studentList.includes('href={`/students/${student.id}`}') && !studentList.includes('target="_blank"'), "學生連結必須留在目前視窗"],
];

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error(failures.map(message => `FAIL: ${message}`).join("\n"));
  process.exit(1);
}

console.log("PASS: PWA 啟動範圍與學生站內導覽設定正確");
