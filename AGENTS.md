# 職域圖譜

## 工作區

- `apps/web/` 負責站點、帳號、趨勢查詢與履歷工作室。職缺匯入和資料庫 migration 位於 `apps/collector/`。
- 將職類、技能判讀與比對規則放在 `packages/domain/`，維持樣本資料與實際來源各自的日期和收錄範圍。
- 更動匯入或趨勢查詢時，保留來源識別、觀測日期、分類版本及不完整涵蓋範圍。顯示必備、加分和僅提及各自的意義。[來源與匯入](apps/collector/README.md)
- 履歷原檔在瀏覽器內解析。只傳送使用者確認的素材，維持 OpenRouter key 僅供該次請求。開發用虛構素材及本機資料庫。

## 開發與驗證

- 使用 Node.js 24 與 Bun 1.4.4。從根目錄執行 `bun install --frozen-lockfile`、`bun run dev`。
- 跑 `bun run typecheck`、`bun run test` 和 `bun run build`。修改網站操作時，依 CI 一併跑 `apps/web/qa/smoke.mjs`。[驗證工作流程](.github/workflows/verify.yml)
