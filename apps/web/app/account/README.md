# GitHub 帳號設定

1. 建立平台專用的 GitHub OAuth App，將首頁設為網站網址，Authorization callback URL 設為 `<網站網址>/api/auth/callback/github`。
2. 在伺服器設定 `DATABASE_URL`、`BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`、`GITHUB_CLIENT_ID` 與 `GITHUB_CLIENT_SECRET`。Better Auth secret 使用至少 32 字元的隨機值。以上值均由伺服器讀取。
3. 設定該環境的資料庫連線後，在 repo 根目錄執行 `bun run db:account`。此指令將 Better Auth 的 PostgreSQL schema 升級到套件版本，並建立帳號收藏與技能表。
4. 開啟 `/account` 登入。平台申請 `user:email` 以完成帳號識別，用帳號 ID 查詢公開作品。OAuth 回呼完成後，帳號資料庫只保留帳號關聯及應用程式登入 session，會清除供應商的 access、refresh、ID tokens。

未設定 GitHub 登入時，技能、收藏與手動標記的投遞紀錄會保存在瀏覽器。登入後讀取目前帳號的設定；瀏覽器訪客設定與各帳號各自保存。使用者選取的公開作品可在履歷頁載入並校對。
