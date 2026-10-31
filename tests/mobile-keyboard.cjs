// Geometry regression, not native OSK emulation. Keep the layout viewport tall
// while a synthetic visual viewport shrinks, as Android Chrome does by default.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(process.env.HTML_PATH || path.join(__dirname, '../index.html'));
const fixture = 'word,translation,part_of_speech,level,lesson\napple,蘋果,n.,B1,1\napricot,杏桃,n.,B1,1\nbanana,香蕉,n.,B1,1\npear,梨子,n.,B1,1\nbeautiful,美麗的;漂亮的,adj.,B1,1';
(async () => {
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        for (const width of [320, 375, 390, 1280]) {
            const page = await browser.newPage({ viewport: { width, height: 740 } });
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.addInitScript(() => {
                const viewport = new EventTarget();
                viewport.height = 740; viewport.offsetTop = 0;
                Object.defineProperty(window, 'visualViewport', { value: viewport });
                window.setKeyboardViewport = (height, offsetTop = 0) => {
                    viewport.height = height; viewport.offsetTop = offsetTop;
                    viewport.dispatchEvent(new Event('resize'));
                };
                window.correctionCalls = 0;
                const scrollBy = window.scrollBy.bind(window);
                window.scrollBy = (...args) => { window.correctionCalls++; scrollBy(...args); };
            });
            await page.route('https://docs.google.com/**', route => route.fulfill({ body: fixture }));
            await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
            await page.waitForSelector('#screenSetup:not(.hidden)');
            assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).display), 'flex', 'Tailwind unavailable');
            await page.evaluate(() => {
                sfx.muted = true; speechEnabled = false;
                document.querySelector('input[value="spelling"]').checked = true;
                handleModeChange(); toggleSelectAll({ checked: true }); startAdventure();
                quizQueue.sort((a, b) => a.word.localeCompare(b.word)); renderQuizQuestion();
            });
            const settle = () => page.waitForTimeout(250);
            const visibleControls = async (includePrompt = true) => {
                await settle();
                assert.equal(await page.locator('#spellingAnswer').evaluate(e => document.activeElement === e), true);
                const v = await page.evaluate(() => ({ top: visualViewport.offsetTop, height: visualViewport.height }));
                const boxes = [];
                for (const selector of ['#spellingAnswer', '#spellingSubmit', ...(includePrompt ? ['#quizContentArea > div:first-child'] : [])]) {
                    const box = await page.locator(selector).boundingBox();
                    assert.ok(box && box.y >= v.top + 11 && box.y + box.height <= v.top + v.height - 11,
                        `${width}: ${selector} clipped: ${JSON.stringify({ box, v })}`);
                    boxes.push(box);
                }
                assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 1, 'input and submit share a row');
                assert.ok(boxes[1].x >= boxes[0].x + boxes[0].width, 'controls do not overlap');
                assert.ok(boxes[1].x + boxes[1].width <= page.viewportSize().width, 'submit stays within screen');
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            };
            const answer = async value => {
                // Avoid Playwright's automatic scrolling masking application bugs.
                await page.evaluate(value => {
                    const input = document.getElementById('spellingAnswer');
                    input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
                }, value);
                await page.keyboard.press('Enter');
            };
            await settle();
            if (width >= 768) {
                const before = await page.evaluate(() => ({ y: scrollY, calls: correctionCalls }));
                await page.evaluate(() => setKeyboardViewport(340)); await settle();
                assert.deepEqual(await page.evaluate(() => ({ y: scrollY, calls: correctionCalls })), before);
                assert.equal(await page.locator('main').evaluate(e => e.style.getPropertyValue('--spelling-keyboard-inset')), '0px');
                await page.close(); continue;
            }
            // Opening animation: only visual height changes; layout stays at 740.
            await page.evaluate(() => { setKeyboardViewport(560); setKeyboardViewport(430); setKeyboardViewport(340); });
            await visibleControls();
            assert.equal(await page.evaluate(() => innerHeight), 740);
            // Viewport panning as well as shrinking: offset is part of the bounds.
            await page.evaluate(() => { scrollTo(0, 0); setKeyboardViewport(280, 35); });
            await visibleControls();
            const beforeTyping = await page.evaluate(() => ({ y: scrollY, calls: correctionCalls }));
            await page.keyboard.type('apple', { delay: 25 }); await settle();
            assert.deepEqual(await page.evaluate(() => ({ y: scrollY, calls: correctionCalls })), beforeTyping);
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => !isWaitingFeedback); await visibleControls();
            assert.equal(await page.locator('#spellingAnswer').inputValue(), '');
            // Second and third questions: assert geometry BEFORE any pointer
            // action. Raw coordinates cannot auto-scroll like locator.click().
            for (const value of ['apricot', 'banana']) {
                const attempts = await page.evaluate(() => quizTotalAttemptsCount);
                await page.keyboard.type(value); await visibleControls();
                const button = await page.locator('#spellingSubmit').boundingBox();
                await page.mouse.dblclick(button.x + button.width / 2, button.y + button.height / 2);
                await page.waitForFunction(() => !isWaitingFeedback); await visibleControls();
                assert.equal(await page.evaluate(() => quizTotalAttemptsCount), attempts + 1, 'double click scores once');
            }
            // Close/reopen without scrolling to the button.
            await page.evaluate(() => setKeyboardViewport(740)); await settle();
            assert.equal(await page.locator('main').evaluate(e => e.style.getPropertyValue('--spelling-keyboard-inset')), '0px');
            await page.evaluate(() => setKeyboardViewport(340)); await visibleControls();
            await page.evaluate(() => { document.getElementById('spellingAnswer').value = 'pretty'; updateSpellingSubmit(); });
            await visibleControls();
            const button = await page.locator('#spellingSubmit').boundingBox();
            await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
            await page.waitForSelector('#spellingAlternativeFeedback:not(.hidden)');
            await page.evaluate(() => setKeyboardViewport(740));
            await page.locator('#spellingAlternativeContinue').click();
            await page.evaluate(() => setKeyboardViewport(340)); await visibleControls();
            await answer('wrong');
            await page.waitForSelector('#feedbackBoard:not(.hidden)');
            await page.evaluate(() => setKeyboardViewport(740)); await settle();
            assert.equal(await page.locator('main').evaluate(e => e.style.getPropertyValue('--spelling-keyboard-inset')), '0px');
            await page.locator('#feedbackBoard button').click();
            await page.evaluate(() => setKeyboardViewport(340)); await visibleControls();
            // Landscape, including the width breakpoint where mobile correction
            // is intentionally disabled, then return to portrait with OSK open.
            await page.setViewportSize({ width: 740, height: width });
            await page.evaluate(() => setKeyboardViewport(220)); await visibleControls(false);
            await page.setViewportSize({ width: 820, height: width });
            await settle();
            assert.equal(await page.locator('main').evaluate(e => e.style.getPropertyValue('--spelling-keyboard-inset')), '0px');
            await page.setViewportSize({ width, height: 740 });
            await page.evaluate(() => setKeyboardViewport(340)); await visibleControls();
            // Long prompt: input has priority, prompt remains reachable above.
            await page.evaluate(() => {
                quizQueue[0] = { ...database.find(x => x.word === 'pear'), translation: '長題目閱讀測試。'.repeat(30) };
                renderQuizQuestion();
            });
            await visibleControls(false);
            const calls = await page.evaluate(() => correctionCalls);
            await page.mouse.wheel(0, -100); await settle();
            assert.equal(await page.evaluate(() => correctionCalls), calls, 'manual reading is not undone');
            await page.evaluate(() => setKeyboardViewport(160)); await visibleControls(false);
            // Also support browsers that shrink the layout viewport itself.
            await page.setViewportSize({ width, height: 360 });
            await page.evaluate(() => setKeyboardViewport(360)); await visibleControls(false);
            await page.setViewportSize({ width, height: 740 });
            await page.evaluate(() => setKeyboardViewport(740)); await settle();
            await page.evaluate(() => exitToSetup()); await settle();
            assert.equal(await page.locator('main > div').evaluate(e => getComputedStyle(e).minHeight), '500px');
            assert.deepEqual(errors, []);
            await page.close();
        }
        console.log('Mobile keyboard geometry passed at 320, 375, 390 and desktop 1280px.');
    } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
