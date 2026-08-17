# PWA Login Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 CoachLog 主畫面 App 可選擇本機模式或 Google 登入，且本機模式保留切換入口。

**Architecture:** PWA 統一從既有首頁 `/` 啟動，由首頁依 NextAuth session 導向 dashboard 或顯示兩種使用方式。本機資料繼續留在瀏覽器，不進行任何自動上傳。

**Tech Stack:** Next.js 16 App Router、React 19、NextAuth 5、Node.js 靜態導覽檢查。

## Global Constraints

- 不自動合併或上傳本機資料至雲端。
- 不改動 Google OAuth、資料庫或 Google Calendar 同步邏輯。
- 保留既有繁體中文 UI。

---

### Task 1: PWA 啟動與切換入口

**Files:**
- Modify: `scripts/check-pwa-navigation.mjs`
- Modify: `app/manifest.ts`
- Modify: `components/LocalCoachApp.tsx`

**Interfaces:**
- Consumes: 既有首頁 `/` 的 session 導向與登入表單。
- Produces: PWA `start_url: "/"`，以及本機頁面的 `href="/"` 登入選擇入口。

- [ ] **Step 1: 寫入失敗測試**

讓導覽檢查要求 manifest 包含 `start_url: "/"`，並讀取 `LocalCoachApp.tsx`、確認存在 `href="/"` 與「登入 Google 帳號」。

- [ ] **Step 2: 確認測試因舊行為失敗**

Run: `node scripts/check-pwa-navigation.mjs`
Expected: FAIL，指出 PWA 未從登入選擇頁啟動，且本機模式缺少登入入口。

- [ ] **Step 3: 實作最小修正**

將 `app/manifest.ts` 的 `start_url` 改為 `/`；在 `LocalCoachApp` 的頂部導覽加入 `<a className="button light" href="/">登入 Google 帳號</a>`。

- [ ] **Step 4: 執行導覽測試與建置**

Run: `node scripts/check-pwa-navigation.mjs`
Expected: PASS。

Run: `npm run build`
Expected: Next.js build exit 0。

- [ ] **Step 5: 檢查差異並提交**

Run: `git diff --check && git status --short`

Commit: `Fix PWA login choice navigation`

### Task 2: 推送與遠端確認

**Files:**
- No source changes.

**Interfaces:**
- Consumes: 已驗證的本機 `main` commit。
- Produces: 與 `origin/main` 同步的遠端版本。

- [ ] **Step 1: 推送 GitHub**

Run: `git push origin main`
Expected: push 成功。

- [ ] **Step 2: 確認同步**

Run: `git rev-parse HEAD && git rev-parse origin/main && git status --short`
Expected: 兩個 SHA 相同，工作目錄乾淨。
