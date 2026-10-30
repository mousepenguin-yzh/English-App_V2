# 中文提示與替代答案審核（2026-10-30）

以包含 PR #7 的 main `675d67b` 為基準。當日重新下載的公開 CSV 共 2,054 筆；唯讀稽核得到 1,743 → 1,760 題，新增 17 題、移除 0 題。Google Sheets 的格式及原始資料均未更動。

## 恢復清單及依據

只審核下列既有義項，沒有自動採用其他「字面不衝突」的義項。表中的同義字關係只適用於該中文提示及單一詞性，不表示所有語境都能互換。

| 目標字 | 詞性 | 實際提示 | 經確認的替代答案 | 判斷及限制 |
| --- | --- | --- | --- | --- |
| class | n. | 班級 | 無 | 原「班級；課程」縮為學生編組，移除與 course 重疊的課程義 |
| heavy | adj. | 重的 | 無 | 原「大量的；重的」縮為重量，移除與 large 重疊的量義 |
| cell | n. | 細胞 | 無 | 原「細胞；手機；牢房」只取生物細胞義，排除手機語境 |
| beautiful | adj. | 漂亮的；美麗的 | pretty、lovely | 外觀美麗義，不能因「美麗的」字面不同而只接受 beautiful |
| pretty | adj. | 漂亮的 | beautiful、lovely | 外觀形容詞；不接受副詞 very 或未審核的 cute |
| lovely | adj. | 漂亮的 | beautiful、pretty | 移除原「討人喜歡的」義，不把 likable 自動列入 |
| smart、clever、intelligent | adj. | 聰明的 | 同組其他兩字 | 智力形容詞；不延伸至衣著整齊、狡猾、智慧等語境 |
| sofa、couch | n. | 沙發 | 同組另一字 | 家具義，不延伸至 couch 的動詞義或診療床義 |
| trash、garbage | n. | 垃圾 | 同組另一字 | 一般廢棄物義，不延伸至動詞或比喻義 |
| movie theater、cinema | n. | 電影院 | 同組另一字 | 放映場所的英美用字；不將 film、movie 或電影藝術義加入 |
| yummy、delicious | adj. | 美味的 | 同組另一字 | 食物味道；容許口語程度差異，不延伸至其他吸引力義 |

共 3 題只縮小義項，13 題接受有限替代答案，1 題（lovely）同時縮小義項及接受替代答案。

外部字典用來核對語意邊界；表中的選字及適合本題的判定是本專案的人工審核決策：

- [American Heritage：beautiful 同義字及差異](https://ahdictionary.com/word/search.html?id=B5143300)
- [Cambridge：smart、clever、intelligent 的用法](https://dictionaryblog.cambridge.org/2024/10/16/wise-brainy-or-astute-words-for-describing-intelligent-people/)
- [Cambridge：sofa](https://dictionary.cambridge.org/us/dictionary/english/sofa)
- [Cambridge：trash](https://dictionary.cambridge.org/us/dictionary/english/trash)
- [Cambridge：cinema](https://dictionary.cambridge.org/us/dictionary/english/cinema)
- [Cambridge：yummy](https://dictionary.cambridge.org/us/dictionary/english/yummy)

未審核的題目仍依原全題庫規則排除。例：problem/question、butter/cream、none/nobody、may/might 涉及語境、材料、句法或情態差異，不能因中文相同就互相接受。多詞性資料（如 kind、mark）不使用中文與詞性的任意配對來恢復。

## 題庫更新保護與維護

`SPELLING_PROMPT_REVIEWS` 與 `spellingPromptSpec` 位於 `index.html`。每筆綁定正規化英文、完整來源中文義項集合及單一詞性；來源中文或詞性改變時退回排除，等待重新審核。提示只取現有義項，原資料及其他四種模式不變。

全題庫原始資料仍參與衝突檢查，包括跨冊課與不支援的英文格式。對實際顯示提示，若出現不在本題目標／確認替代答案集合中的衝突字，該題排除。加入新清單前需人工審核語意、詞性、所有接受答案與來源變動測試；不採用傳遞閉包、自動同義字擴展或 AI 判題。

此保護能偵測來源變動及相同中文義項的新衝突，不能自動理解新增資料裡字面不同的語意重疊，也不聲稱接受所有英文同義字。題庫擴充仍需老師抽查。17 題是當日快照結果，不保證日後固定題數。

可重跑唯讀稽核（CSV 路徑自行指定；不會修改快照）：

```sh
node tests/audit-spelling.cjs path/to/snapshot.csv
```

## 回饋、重練及計分

每次非空白且通過操作鎖的送出，總作答數及本題作答數都加一。空白、組字確認或回饋期間重複送出不計數。

| 作答 | 回饋及進度 | 首次目標拼寫正確 |
| --- | --- | --- |
| 首次目標字 | 答對音效，完成題目 | 是 |
| 首次確認的替代答案 | 正向文字及答對音效；按繼續後移到隊尾一次 | 否，但不顯示錯誤／不播錯誤音 |
| 首次拼錯 | 沿用錯誤解析及隊尾重練 | 否 |
| 重練目標字 | 完成題目 | 不回補 |
| 重練再答替代答案 | 正向回饋並明示完整目標字；按繼續留在當題，不再移隊尾 | 不回補 |

替代答案後的重練會標示「目標字重練」、首字母及字元數，說明同義字不再延後。若再答替代答案或拼錯，後續輸入框上方顯示完整目標字，可照著拼寫完成。重複同義字不會自動結題，也不會產生新的佇列項目或反覆移到隊尾；必須拼出目標字才完成。真正拼錯仍沿用原重考機制。

PR #7 的題庫完整變體（例如 autumn/fall）仍為該題的完整目標答案，任一合法變體直接完成並可計首次正確；與本次針對「另一個目標單字」的替代答案分開處理。

例如 beautiful 首答 pretty、apple 首答正確、class 首答拼錯；beautiful 重練再答兩次 pretty 後拼出 beautiful、class 重練拼對：3 題共 7 次，首次目標拼寫正確率 33%。瀏覽器測試固定驗證此案例及音效、重複操作與重新開始。

## 測試與手機人工驗收

單元測試涵蓋 17 筆審核規則、來源與詞性改變、新衝突、拼字嚴格性、資料不變性及 PR #7 格式。瀏覽器涵蓋替代答案回饋／只移隊尾一次、留在當題的多次替代答案、完成與計分、重新開始、四種原模式、320/375px 排版及真實 CSV 抽選 20 題完成。

實機仍需在 iOS Safari、Android Chrome 各驗收：

1. 英文鍵盤開啟時，長回饋、繼續按鈕及重練輸入框可捲動到可見範圍；直向／橫向無遮擋。
2. 以 beautiful → pretty 觸發正向回饋，確認無錯誤音；按繼續後稍後重練，看到首字母；再答 pretty 後看到完整 beautiful，照拼可完成。
3. 鍵盤 Enter、送出鈕、組字確認與快速連點不重複計分；回饋按繼續後焦點回到英文輸入框，原生鍵盤行為合理。
4. 核對首次正確率不回補、每次有效送出都計數；保留 README 原有特殊格式與其他模式驗收項目。
