# CoachLog

健身教練的學生、訓練與身體組成紀錄網站。

## 本機啟動

1. 複製 `.env.example` 為 `.env.local` 並填入 PostgreSQL 與 Google OAuth。
2. Google Cloud 啟用 Google Calendar API，OAuth redirect URI 設為 `http://localhost:3000/api/auth/callback/google`。
3. 執行 `npm install && npm run db:migrate && npm run dev`。

## Railway

1. 建立 Railway Project，加入 PostgreSQL service。
2. 從 GitHub repo 建立 Web service。
3. 設定 `DATABASE_URL`（引用 PostgreSQL）、`AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`AUTH_TRUST_HOST=true`。
4. 取得 Railway 網域後，在 Google OAuth 加入 `https://你的網域/api/auth/callback/google`。

行事曆事件 description 若包含 `student:<學生 UUID>`，首頁點擊該事件會直接開啟學生紀錄頁。

## 測試

- `npm test`：單元測試與靜態檢查（不需要資料庫）。
- `npm run check:cloud`：登入後實際載入雲端頁面，抓 build 與型別檢查看不到的執行期錯誤，
  例如把事件處理函式傳進 server component。需要一個可寫入的測試資料庫：

  ```
  CHECK_DATABASE_URL=postgresql://user:password@localhost:5432/coachlog_test npm run check:cloud
  ```

  沒有設定 `CHECK_DATABASE_URL` 時會直接跳過。檢查用的資料會在結束時刪除。
