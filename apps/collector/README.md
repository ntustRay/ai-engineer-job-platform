# TaiwanJobs collector

每天查詢勞動力發展署台灣就業通雙北市的資訊相關職缺。範圍為臺北市（01）、新北市（31）各自搭配通俗職業代碼前綴 0801、0802、0803。每一組獨立記錄，以台灣日期計算。查詢覆蓋範圍與職缺需求計數均限於這些來源。

在 repo 根目錄執行：

```sh
bun run --filter @job/collector probe
bun run --filter @job/collector migrate
bun run --filter @job/collector collect
bun run --filter @job/collector test
```

`probe` 可在無資料庫下查詢來源，在此 package 目錄執行 `bun run probe --output snapshot.json` 可把本次取得的職缺與各查詢狀態寫入本機。資料庫指令使用環境變數 `DATABASE_URL`。

每筆職缺以來源和 HIRE_ID 識別。每批觀測以 transaction 寫入；同一批重試時可安全回放。內容、技能辨識規則版本相同時會重用原版本。觀測仍保留其日期與當時所見版本。市場查詢應區分必備、加分和僅提及技能，對齊兩期來源，並顯示樣本規模。搭配 `collector_runs` 讀取各日成功、截斷、部分或失敗記錄；需要比較完整日期時須檢查六個預期範圍是否齊全。

超過或達到每組上限 1,000 筆標記為 `capped`。空內容、略過格式錯誤或範圍不符的列標記為 `partial`。只有完整查詢才可依缺席判定不再刊登，過截止日的職缺亦會從目前可投清單移除；來源失敗保留既有資料及失敗狀態。首次觀測日期代表平台首次看見，職缺更新日取自來源的 TRANDATE。

來源：勞動部勞動力發展署，「台灣就業通網站職缺清單」，[政府資料開放授權條款第 1 版](https://data.gov.tw/license)。[資料集與欄位](https://data.gov.tw/dataset/44062) · [Web Service 規格](https://free.taiwanjobs.gov.tw/webservice_taipei/A17000000J-030144-Taiwanjobs-OpenData.pdf) · [職類查詢](https://jobooks.taiwanjobs.gov.tw/News4.aspx?n=11&sms=8450)
