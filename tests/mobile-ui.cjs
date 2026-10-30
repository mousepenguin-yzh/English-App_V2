// UI regression and repeatable before/after captures; no production data changes.
// PLAYWRIGHT_MODULE may point to an existing installation. HTML_PATH selects a
// baseline HTML; UI_BASELINE=1 captures it without asserting the new typography.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(process.env.HTML_PATH || path.join(__dirname, '../index.html'));
const baseline = process.env.UI_BASELINE === '1';
const output = process.env.SCREENSHOT_DIR || path.join(__dirname, '../docs/mobile-ui/screenshots', baseline ? 'before' : 'after');
const longEn = 'During the school holidays, we worked together to understand this important idea and explained it to our friends. '.repeat(5);
const longCh = '放暑假的時候，我們一起努力理解這個重要的想法，並且用自己的話向朋友說明學習的過程。'.repeat(5);
const rows = [
    { word: 'misunderstanding', translation: '誤解；對某人說的話或某件事情產生不正確的理解與想法', part_of_speech: 'n.', level: 'B5', lesson: '1', example_en: 'A misunderstanding happened. ' + longEn, example_ch: longCh },
    { word: 'take responsibility for the environment', translation: '為環境負起責任並且照顧我們生活的地方', part_of_speech: 'phr.', level: 'B5', lesson: '2', example_en: longEn, example_ch: longCh },
    { word: 'extraordinarilylongunbrokenwordforlayout', translation: '測試長字', part_of_speech: 'n.', level: 'B5', lesson: '2', example_en: longEn, example_ch: longCh },
    { word: 'understand', translation: '了解；明白；理解對方所表達的完整意思', part_of_speech: 'v.', past_tense: 'understood', past_participle: 'understood', level: 'B5', lesson: '1', example_en: 'We understand the question. ' + longEn, example_ch: longCh },
    { word: 'beautiful', translation: '美麗的;漂亮的', part_of_speech: 'adj.', level: 'B1', lesson: '1', example_en: longEn, example_ch: longCh }
];
(async () => {
    fs.mkdirSync(output, { recursive: true });
    const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const report = [];
        for (const width of [320, 375, 390, 1280]) {
            const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 900 : 740 }, isMobile: width < 768, hasTouch: width < 768 });
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.addInitScript(() => {
                let seed = 42;
                Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
            });
            await page.route('https://docs.google.com/**', route => route.fulfill({ body: 'word,translation,part_of_speech,level\napple,蘋果,n.,B1' }));
            await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
            await page.waitForSelector('#screenSetup:not(.hidden)');
            // Fail clearly if the existing Tailwind CDN did not load.
            assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).display), 'flex', 'Tailwind unavailable');
            await page.evaluate(rows => { database = rows; sfx.muted = true; speechEnabled = false; renderLevelSelectors(); handleModeChange(); }, rows);
            let captures = 0;
            const capture = async name => {
                captures++;
                // Let the existing 3D transition finish before capturing a face.
                await page.locator('#fcCardInner').evaluate(e => Promise.all(e.getAnimations().map(a => a.finished.catch(() => {}))));
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled' });
                if (!baseline) {
                    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
                    assert.equal(overflow, false, `${width} ${name}: horizontal overflow`);
                    const clipped = await page.locator('.option-text:visible, #questionText:visible, #fcWord:visible, #fcTranslation:visible').evaluateAll(es => es.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.id || e.className));
                    assert.deepEqual(clipped, [], `${width} ${name}: clipped learning text`);
                }
            };
            const setup = async mode => page.evaluate(mode => {
                exitToSetup(); document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
                handleModeChange(); toggleSelectAll({ checked: true });
            }, mode);
            const startWith = async index => page.evaluate(index => {
                startAdventure(); quizQueue = [database[index]]; originalQuizCount = 1; currentQuizIndex = 0;
                if (currentMode === 'flashcard') setupFlashcardView(); else renderQuizQuestion();
            }, index);
            await setup('spelling');
            await page.locator('[data-level-card="B5"] button').click();
            await capture('setup');
            await setup('flashcard'); await startWith(3); await capture('card-front');
            await page.locator('.perspective-1000').click(); await page.waitForTimeout(650); await capture('card-back');
            const example = page.locator('.card-back > div:nth-child(2)');
            await example.evaluate(e => { e.scrollTop = e.scrollHeight; });
            assert.ok(await example.evaluate(e => e.scrollTop > 0));
            assert.ok(await page.locator('#fcCardInner').evaluate(e => e.classList.contains('card-flipped')));
            await capture('card-back-scrolled');
            if (!baseline) {
                const translationBox = await page.locator('#fcTranslation').boundingBox();
                const exampleBox = await example.boundingBox();
                assert.ok(translationBox.y + translationBox.height <= exampleBox.y, 'translation must not overlap examples');
                const face = await page.locator('.card-back').boundingBox();
                assert.ok(exampleBox.y + exampleBox.height < face.y + face.height, 'examples must stay inside card');
                assert.ok(await page.locator('#speechBtn').evaluate(e => e.clientWidth >= 44 && e.clientHeight >= 44));
            }
            await page.locator('[onclick="nextFlashcard()"]').click();
            await setup('flashcard'); await startWith(2); await capture('long-word');
            await setup('flashcard'); await startWith(1); await capture('long-phrase');
            for (const mode of ['en-ch', 'ch-en', 'cloze']) {
                await setup(mode); await startWith(0);
                if (mode === 'cloze') await page.locator('#toggleTranslationBtn').click();
                await capture(mode);
            }
            await setup('spelling'); await startWith(4);
            await page.locator('#spellingAnswer').fill('pretty'); await capture('spelling');
            await page.locator('#spellingSubmit').click(); await capture('synonym');
            await page.locator('#spellingAlternativeContinue').click(); await capture('target-review');
            // A reduced visual viewport exercises document scrolling while typing.
            // Native iOS/Android keyboard behavior still requires device QA.
            await page.setViewportSize({ width, height: 360 });
            await page.locator('#spellingAnswer').fill('wrong');
            await page.locator('#spellingSubmit').scrollIntoViewIfNeeded();
            await page.locator('#spellingSubmit').click();
            await page.setViewportSize({ width, height: width === 1280 ? 900 : 740 });
            await capture('wrong-answer');
            await page.locator('#feedbackBoard button').click();
            await page.locator('#spellingAnswer').fill('beautiful'); await page.locator('#spellingSubmit').click();
            await page.waitForSelector('#screenSummary:not(.hidden)'); await capture('summary');
            assert.equal(await page.locator('#totalAttemptsValue').innerText(), '3 次');
            assert.equal(await page.locator('#initialAccuracyScore').innerText(), '0%');
            if (!baseline && width < 768) {
                await setup('en-ch'); await startWith(0);
                assert.ok(await page.locator('.option-btn').first().evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 18));
                await setup('spelling');
                assert.ok(await page.locator('#spellingNotice').evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 14));
            }
            assert.deepEqual(errors, []);
            report.push({ width, captures, pageErrors: errors.length });
            await page.close();
        }
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log(`UI ${baseline ? 'baseline captures' : 'regression'} passed at 320, 375, 390, 1280px. Screenshots: ${output}`);
    } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
