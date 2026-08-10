import { readFileSync } from "node:fs";

const globalCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const settingsCss = readFileSync(new URL("../components/CalendarSettings.css", import.meta.url), "utf8");

const checks = [
  ["受影響的表單控制項可以縮到容器內", /\.calendar-settings input,[\s\S]*?\.appointment-card textarea\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%/s.test(settingsCss)],
  ["預約 Flex 欄位不保留 intrinsic width", /\.appointment-card \.row\s*>\s*\*\s*\{[^}]*min-width:\s*0/s.test(settingsCss)],
  ["時段欄位標籤可以縮到卡片內", /\.period-card label\s*\{[^}]*min-width:\s*0/s.test(settingsCss)],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error(failed.map(([name]) => `FAIL: ${name}`).join("\n"));
  process.exit(1);
}

console.log("PASS: iPhone Safari 表單欄位不會撐破容器");
