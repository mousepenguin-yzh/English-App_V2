# 手機閱讀與操作驗收

基準：`main` 的 `521cb51`（包含 PR #8）。本次只修改 `index.html` 的呈現樣式與翻卡操作提示；JavaScript、題庫、五模式順序及判題流程均保持不變。

## 原有問題與調整

| 區域 | 原本手機呈現 | 本次調整 |
| --- | --- | --- |
| 首頁模式 | 說明 11px、標題 14px | 說明 14px / 1.65 行高、標題 18px；保留五模式順序 |
| 冊課與題數 | 冊課 12px、展開及課次勾選區偏小 | 冊課 16px、勾選框 18px、標籤與展開鈕至少 44px、題數至少 48px |
| 單字卡 | 固定 330px 高、背面例句上限 140px、三態 10–11px | 兩面共同撐高卡片、最小 380px；例句捲動區上限 240px；三態與提示 14px；英文例句 18px、中文 16px / 1.7 行高 |
| 題目與選項 | 選項 12px，長字無可靠斷行 | 選項 18px / 1.6、至少 56px 高；題目 26–36px；克漏字 22–28px / 1.65 並靠左閱讀 |
| 拼字 | 說明 12px | 輸入 18px、說明 14px、狀態 16px / 1.7；輸入及送出可隨頁面捲動 |
| 錯題解析 | 中英文例句 11–12px、360px 內部捲動 | 英文例句 18px、中文 16px；正解 24px 並獨立成行；整頁捲動可讀到全部內容及繼續鈕 |
| 結算 | 說明 10px、操作鈕 12px | 說明 14px / 1.7、操作鈕 16px 且至少 48px |
| 共用版面 | 窄螢幕標題與工具列擁擠、固定導覽佔用可見高度 | 手機導覽隨頁面捲動，保留所有控制；外側 8px / 內側 12px；返回列可換行；音訊按鈕至少 44px |

長字與片語只在必要時斷行，沒有隱藏學習內容。單字卡保留 3D 翻面，背面新增例句可捲動提示。桌面仍使用原本雙欄設定／選項版面、深色主題與配色。

## 修改前後截圖

Playwright 使用相同固定測試資料與隨機種子。每組包含 320、375、390、1280px，每尺寸 14 張，總計 112 張。`before` 為上述 main 原版，`after` 為本次修改版。資料刻意包含超長連字、片語及重複五次的中英文例句，屬排版壓力測試，不修改正式題庫。

以下列出 375px 對照；其他尺寸替換檔名中的 `375` 即可。

| 畫面 | 修改前 | 修改後 |
| --- | --- | --- |
| 首頁／冊課展開／題數 | [前](screenshots/before/375-setup.png) | [後](screenshots/after/375-setup.png) |
| 單字卡正面與三態 | [前](screenshots/before/375-card-front.png) | [後](screenshots/after/375-card-front.png) |
| 長翻譯與例句背面 | [前](screenshots/before/375-card-back.png) | [後](screenshots/after/375-card-back.png) |
| 例句捲動至中文末端 | [前](screenshots/before/375-card-back-scrolled.png) | [後](screenshots/after/375-card-back-scrolled.png) |
| 超長英文單字 | [前](screenshots/before/375-long-word.png) | [後](screenshots/after/375-long-word.png) |
| 長英文片語 | [前](screenshots/before/375-long-phrase.png) | [後](screenshots/after/375-long-phrase.png) |
| 英選中 | [前](screenshots/before/375-en-ch.png) | [後](screenshots/after/375-en-ch.png) |
| 中選英 | [前](screenshots/before/375-ch-en.png) | [後](screenshots/after/375-ch-en.png) |
| 克漏字及中文提示 | [前](screenshots/before/375-cloze.png) | [後](screenshots/after/375-cloze.png) |
| 拼字輸入 | [前](screenshots/before/375-spelling.png) | [後](screenshots/after/375-spelling.png) |
| 同義字回饋 | [前](screenshots/before/375-synonym.png) | [後](screenshots/after/375-synonym.png) |
| 目標字重練 | [前](screenshots/before/375-target-review.png) | [後](screenshots/after/375-target-review.png) |
| 錯題解析 | [前](screenshots/before/375-wrong-answer.png) | [後](screenshots/after/375-wrong-answer.png) |
| 結算 | [前](screenshots/before/375-summary.png) | [後](screenshots/after/375-summary.png) |

## 自動化驗證

- `node --test tests/spelling.test.cjs`：13/13 通過。
- `node tests/browser.cjs`：既有完整瀏覽器回歸通過，包括五模式、冊課篩選、同義字處理、錯題及目標字重練、計分、連點競態與空題庫。
- `node tests/mobile-ui.cjs`：320/375/390/1280px 全部通過；檢查頁面水平溢出、主要文字裁切、卡片翻面與例句捲動、背面區塊無重疊、選項及提示字級、音訊觸控範圍、同義字後重練與結算數值，以及頁面 JavaScript 錯誤。每尺寸也縮至 360px 高，實際捲到拼字送出鈕並點擊。
- 原版與修改版 `<script>` 內容逐字比較相同；`git diff --check` 通過。
- 已人工開啟檢視窄螢幕首頁、單字卡、長字／片語、英選中、克漏字、拼字重練、解析與結算，以及桌面背面截圖。自動斷言不取代截圖審查。

測試沿用既有 Playwright／Chrome，不新增應用程式依賴或 CI。若已有 Playwright，可設定 `PLAYWRIGHT_MODULE` 指向該模組。產生前版截圖時，將基準 HTML 匯出到本機檔案，設定 `HTML_PATH` 與 `UI_BASELINE=1` 再執行 `tests/mobile-ui.cjs`；`SCREENSHOT_DIR` 可另外指定輸出目錄。測試會確認 Tailwind CDN 已載入，避免在無樣式狀態產生誤導截圖。

## 仍需簡短手機人工驗收

需要。此次瀏覽器為桌面 Chrome 的手機尺寸／觸控模擬，縮小 viewport 不能完整重現原生鍵盤。請在 iOS Safari 與 Android Chrome 各檢查：

1. 單字卡翻面後上下滑動長例句，確認中文末端可讀、滑動不意外翻面，點擊可翻回；換卡正常。
2. 拼字模式開啟鍵盤，確認輸入框及送出鈕可捲到可見處；以 Enter 和按鈕各送出，檢查同義字後繼續與重練。
3. 直向／橫向切換、系統放大字體後，檢查返回、提示、解析繼續及結算重新挑戰按鈕。

超長內容會增加頁面高度，這是保留完整內容的預期結果。字型載入、Safari 3D 合成、原生鍵盤／輸入法及作業系統字體縮放仍可能與此處 Chrome 截圖不同。
