# 職域圖譜

台灣工程師的個人求職工作台。探索雙北工程職缺，比對已確認的技能與職缺原句，查看各職位的技能需求變化。履歷工作室支援貼上文字或匯入文件、選取自己的公開 GitHub 作品、編輯草稿、列印 PDF。

## 本機啟動

使用 Node.js 24 與 Bun 1.4.4。在 repo 根目錄執行：

```sh
bun install
bun run dev
```

開啟 http://localhost:3000 。初次啟動會載入有來源與日期的台灣就業通選樣。技能、收藏與手動投遞標記可保存在這個瀏覽器。從「市場趨勢」點選一格，再選月份，即可查看支持該數字的職缺。「官方歷年調查」另收錄 2022–2024 年資訊服務業 AI 人才招募難易。

## 專案結構

| 路徑 | 職責 |
| --- | --- |
| `apps/web` | Next.js 網站、個人技能、趨勢查詢、GitHub 登入與履歷工作室 |
| `apps/collector` | 台灣就業通匯入、同步狀態、版本與每日觀測 |
| `packages/domain` | 職類與技能字典、條件原句、擇一條件與推薦依據 |

## 啟用職缺同步及帳號

1. 建立專用 PostgreSQL 或 Neon 專案。在 repo 根目錄的 `.env.local` 設定 `DATABASE_URL`，另在 `apps/web/.env.local` 設定網站使用的連線字串。變數清單見 `.env.example`。
2. 執行 `bun run migrate`、`bun run db:account`、`bun run collect`，然後重新啟動網站。
3. 每日同步由 GitHub Actions 執行，預定台灣時間 06:17 啟動。將專案專用連線字串設為 repository Actions secret `DATABASE_URL`，可從 **Collect Taiwan engineering jobs** 手動跑第一次同步並查看各收錄範圍的筆數與狀態。排程只擷取公開職缺。
4. 啟用 GitHub OAuth 時，依 [帳號設定](apps/web/app/account/README.md) 設定專用 client。登入者可在工作室確認要傳送的素材，使用自己的 OpenRouter API key 生成。Key 只用於當次請求，履歷原檔在瀏覽器內解析。
5. 在 Vercel 建立個人 Preview 時，框架選 Next.js，Root Directory 設為 `apps/web`，並允許讀取專案根目錄以外的 workspace packages。需要帳號功能時，使用與 OAuth callback 相符的固定網址。

## 數字怎麼讀

- 「新收錄」依平台第一次看見該職缺的台灣日期計算。匯入開始當天可能包含早已在原站刊登的職缺。
- 每個月份、職類中的同一職缺只計一次。資料保存觀測時間、同步範圍和內容版本，同來源截斷或失敗會標示涵蓋狀態。
- 同一句「React 或 Vue 擇一」是一組條件。「K8s 尤佳」歸為加分。比對只代表與明列技能條件的符合情形。技能頁可查看補上某項技能後多符合哪些職缺。
- 首頁最多載入最近收錄的 500 筆有效職缺。歷史統計使用資料庫最近 12 個月的觀測，每次提供所選月份最多 12 筆職缺作為佐證。月資料與分類規則可比時才繪製趨勢線。

## 驗證

```sh
bun run typecheck
bun run test
bun run build
```

SQL 測試使用實際 PostgreSQL 相容的 PGlite 執行 migration 與查詢。職缺來源與涵蓋限制見 [collector 說明](apps/collector/README.md)。

## 資料來源

[勞動部勞動力發展署．台灣就業通網站職缺清單](https://data.gov.tw/dataset/44062) 採[政府資料開放授權條款第 1 版](https://data.gov.tw/license)。[近年資訊服務業 AI 人才質性需求分析表](https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=56141&pid=256261) 引用國發會人才調查；歷年招募難易度與平台職缺的技能占比分別呈現。

