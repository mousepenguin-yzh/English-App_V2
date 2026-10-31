# 手機閱讀與操作驗收

基準：`main` 的 `521cb51`（包含 PR #8）。原版閱讀調整修改 `index.html` 的呈現樣式與翻卡操作提示；後續 Android 鍵盤修正另調整手機拼字焦點與捲動，題庫、五模式順序及判題流程均保持不變。

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
- 原版閱讀調整的 `<script>` 內容逐字相同；後續鍵盤修正僅增加焦點／viewport 呈現處理。`git diff --check` 通過。
- 已人工開啟檢視窄螢幕首頁、單字卡、長字／片語、英選中、克漏字、拼字重練、解析與結算，以及桌面背面截圖。自動斷言不取代截圖審查。

測試沿用既有 Playwright／Chrome，不新增應用程式依賴或 CI。若已有 Playwright，可設定 `PLAYWRIGHT_MODULE` 指向該模組。產生前版截圖時，將基準 HTML 匯出到本機檔案，設定 `HTML_PATH` 與 `UI_BASELINE=1` 再執行 `tests/mobile-ui.cjs`；`SCREENSHOT_DIR` 可另外指定輸出目錄。測試會確認 Tailwind CDN 已載入，避免在無樣式狀態產生誤導截圖。

## Android Chrome／Gboard 第一次鍵盤修正（50903ed，歷史紀錄）

實機回報的原因是 `focus({ preventScroll: true })` 禁止原生焦點捲動，且手機拼字仍沿用外卡片 500px 最小高度、`quizContentArea` 的自動邊距／垂直置中。文字與按鈕放大後，輸入區更容易落在鍵盤下方。Android Chrome 預設只縮小 visual viewport，既有縮小整個 viewport 並由 Playwright 主動捲到按鈕的檢查不足以涵蓋此情況（[Chrome 說明](https://developer.chrome.com/blog/viewport-resize-behavior)）。

- 手機拼字表單顯示時取消最小高度及垂直置中，內容從上方自然排列；保留全頁捲動。
- 保留每題自動聚焦，手機允許原生焦點捲動，桌面保留 `preventScroll`。
- 換題、focus／blur、window／visual viewport resize 後等待 120ms，再依可見區高度與 offsetTop 檢查輸入框；只有被裁切才補正。題目與輸入框放得下時一併保留，長題目優先完整顯示輸入框。
- 依鍵盤遮擋高度提供頁尾捲動空間，讓送出鈕可正常捲上來；收起鍵盤或離開輸入區後清除。沒有 input 或 scroll 事件校正，打字與手動捲動不會反覆被拉回。
- 未修改判題、計分、題庫、音效、資料載入及其他模式；未新增依賴或 GitHub Actions。

新增 `node tests/mobile-keyboard.cjs`：320／375／390px 保留 740px layout viewport，模擬 visual viewport 縮至 340px／帶 35px 偏移的 280px。涵蓋自動聚焦、完整輸入框、可讀題目、逐字輸入不捲動、連續正確換題、一般滾輪少量捲動點送出、同義字回饋及目標字重練、錯題解析後續答、長題目、鍵盤收合、layout viewport 同步縮小與返回首頁；1280px 檢查不介入桌面捲動。測試避免用 Playwright 自動捲動掩蓋輸入區問題。

修正前的 `17551c2` 執行新檢查會失敗：320px 的輸入框落在 y=428.89–482.89，可見高度只有 340px。修正後新檢查通過；13/13 單元測試、既有 `browser.cjs` 與 `mobile-ui.cjs`（320／375／390／1280px）通過。既有 112 張截圖是原閱讀調整的歷史紀錄，未重新覆寫；此次重跑 UI 截圖另存暫存目錄。

此測試模擬 viewport 幾何與事件，沒有真正喚起 Android／Gboard。仍需 Android Chrome 實機確認：進入拼字、連續答對、錯題解析、同義字後重練、按鈕與 Enter 送出、收起鍵盤後恢復版面。

## 第二次手機驗收：輸入框與送出按鈕同列

第一次閱讀調整保留直向堆疊表單；第一次鍵盤修正只確認輸入框邊界，並在輸入框可見時提早返回。說明文字與狀態欄位仍把送出按鈕推到下方，即使第一題勉強露出按鈕，連續換題也沒有保障。原測試允許先捲到按鈕才點擊，因此未攔下實機問題。

本次僅調整拼字表單呈現與 viewport 定位：

- 767px 以下將輸入框與完整「送出答案」按鈕放進同一水平操作列；輸入框可縮、按鈕不縮，間距 8px，說明／狀態置於操作列下方。桌面維持全寬輸入與按鈕。
- 定位檢查整個操作列，包含 disabled 按鈕。若題目與操作列放得下，一併保持在 visual viewport 內；超長題目及極短高度優先保持操作列完整，相鄰控制不分離，題目可正常捲動閱讀。
- 沿用自動聚焦、原生表單 Enter、120ms resize debounce、鍵盤頁尾空間；不新增 input／scroll 定位監聽，不修改判題、計分、重練、題庫或音效。

驗證：

- `node --test tests/spelling.test.cjs`：13/13 通過。
- `node tests/browser.cjs`：完整既有瀏覽器回歸通過。
- `node tests/mobile-ui.cjs`：320／375／390／1280px 通過，已檢視 320px 拼字操作列與桌面截圖；本次截圖另存暫存目錄，未覆寫原閱讀調整的歷史截圖。
- `node tests/mobile-keyboard.cjs`：320／375／390／1280px 通過。每次同時斷言輸入框、送出按鈕與一般題目的完整邊界，包含第一題、連續正確換至第二／第三／第四題、viewport offset、逐字輸入不捲動、原始座標直接點擊／雙擊且只計分一次、Enter、同義字與目標字重練、錯題解析、鍵盤收合／重開、740px 橫向與 820px breakpoint 往返、長題目、160px 極短可視高度、layout viewport 同步縮小與回首頁。長題目／極短高度僅要求操作列完整並允許正常閱讀捲動。
- 幾何檢查與送出點擊之前均未呼叫 `locator.click()`、`fill()` 或 `scrollIntoView()`，連續換題不能藉由 Playwright 自動捲動通過。
- 同一新測試套用在修正前 `50903ed` 會失敗：320px 的 `#spellingSubmit` 位於 y=346.58–394.58，超出 340px visual viewport；修正後全部通過。`git diff --check` 通過。

不新增依賴或 CI。仍待 Android Chrome／Gboard 實機驗收，PR #9 保持開啟，不合併 main。

## 仍需簡短手機人工驗收

需要。此次瀏覽器為桌面 Chrome 的手機尺寸／觸控模擬，縮小 viewport 不能完整重現原生鍵盤。請在 iOS Safari 與 Android Chrome 各檢查：

1. 單字卡翻面後上下滑動長例句，確認中文末端可讀、滑動不意外翻面，點擊可翻回；換卡正常。
2. 一般直向拼字模式開啟鍵盤，第一題及連續答對後的第二、第三題須同時看見題目、輸入框及送出鈕，無須手動捲動；以 Enter 和按鈕各送出，檢查同義字後繼續與重練。超長題目／極短高度允許正常捲動。
3. 直向／橫向切換、系統放大字體後，檢查返回、提示、解析繼續及結算重新挑戰按鈕。

超長內容會增加頁面高度，這是保留完整內容的預期結果。字型載入、Safari 3D 合成、原生鍵盤／輸入法及作業系統字體縮放仍可能與此處 Chrome 截圖不同。
