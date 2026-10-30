// Optional browser regression: install Playwright locally, or set PLAYWRIGHT_MODULE
// to an existing installation. Uses installed Chrome; no browser download needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync(path.join(__dirname, '../index.html'));
const fixture = [
    'word,translation,part_of_speech,level,lesson,example_en,example_ch',
    'apple,蘋果,n.,B1,1,An apple.,一顆蘋果。',
    'ice cream,冰淇淋,n.,B1,2,Ice cream is cold.,冰淇淋是冷的。',
    "don't,不要,aux.,B1,2,Don't run.,不要跑。",
    'beautiful,漂亮的,adj.,B1,1,,',
    'pretty,漂亮的,adj.,B6,1,,',
    'may / might,可能,aux.,B1,1,,',
    'pear,梨子,n.,B5,1,A pear.,一顆梨。',
    'well-known,知名的,adj.,B6,2,A well-known singer.,知名歌手。',
].join('\n');

(async () => {
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://docs.google.com/**', route => route.fulfill({ body: fixture }));
        await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('#screenSetup:not(.hidden)');
        await page.evaluate(() => {
            sfx.muted = true;
            window.spokenWords = [];
            speechSynthesis.speak = utterance => window.spokenWords.push(utterance.text);
        });
        const mode = async value => page.locator(`input[name="mode"][value="${value}"]`).check({ force: true });
        const all = async () => page.locator('#selectAllCheckbox').check();
        const start = async () => page.locator('[onclick="startAdventure()"]').click();
        const exit = async () => page.evaluate(() => exitToSetup());
        const state = () => page.evaluate(() => ({
            attempts: quizTotalAttemptsCount, correct: firstAttemptCorrectCount,
            count: originalQuizCount, queue: quizQueue.map(x => x.word),
            histories: Object.values(quizHistory)
        }));
        const answer = async text => {
            await page.locator('#spellingAnswer').fill(text);
            await page.locator('#spellingAnswer').press('Enter');
        };
        const advance = async () => page.waitForFunction(() =>
            !isWaitingFeedback || !document.getElementById('screenSummary').classList.contains('hidden'));

        await mode('spelling'); await all();
        assert.equal(await page.locator('#wordPoolCount').innerText(), '5');
        await start();
        assert.equal((await state()).count, 5);
        assert.equal(await page.locator('#optionsGrid').isVisible(), false);
        assert.equal(await page.locator('#quizSpeakBtn').isVisible(), false);
        assert.equal(await page.locator('#spellingAnswer').getAttribute('autocorrect'), 'off');
        assert.equal(await page.locator('#spellingAnswer').getAttribute('autocomplete'), 'off');
        assert.equal(await page.locator('#spellingAnswer').getAttribute('autocapitalize'), 'none');
        assert.equal(await page.locator('#spellingAnswer').getAttribute('spellcheck'), 'false');
        assert.match(await page.locator('#questionLevel').innerText(), /第 \d 課/);
        await page.locator('#spellingAnswer').fill('   ');
        assert.equal(await page.locator('#spellingSubmit').isDisabled(), true);
        await page.evaluate(() => submitSpellingAnswer({ preventDefault() {} }));
        assert.equal((await state()).attempts, 0);
        await page.locator('#spellingAnswer').fill('wrong');
        await page.locator('#spellingAnswer').dispatchEvent('keydown', { key: 'Enter', isComposing: true });
        assert.equal((await state()).attempts, 0);
        const first = (await state()).queue[0];
        await answer('wrong');
        assert.equal(await page.locator('#feedbackCorrectWord').innerText(), first);
        assert.equal(await page.locator('#feedbackBoard').isVisible(), true);
        await page.evaluate(() => submitSpellingAnswer({ preventDefault() {} }));
        assert.equal((await state()).attempts, 1);
        await page.evaluate(() => { proceedAfterFeedback(); proceedAfterFeedback(); });
        assert.equal((await state()).queue.at(-1), first);
        assert.equal(await page.locator('#spellingAnswer').inputValue(), '');

        // Complete all answers with case/outer-space tolerance; duplicate submits
        // during each 800ms transition must not alter queue or counters twice.
        for (let i = 0; i < 5; i++) {
            const next = (await state()).queue[0];
            await answer(`  ${next.toUpperCase()}  `);
            await page.evaluate(() => {
                submitSpellingAnswer({ preventDefault() {} });
                proceedAfterFeedback();
            });
            assert.equal((await state()).attempts, i + 2);
            await advance();
        }
        assert.equal(await page.locator('#initialAccuracyScore').innerText(), '80%');
        assert.equal(await page.locator('#totalAttemptsValue').innerText(), '6 次');
        assert.equal((await state()).histories.reduce((sum, h) => sum + h.totalAttempts, 0), 6);

        await page.evaluate(() => restartSameAdventure());
        assert.equal((await state()).attempts, 0);
        await answer((await state()).queue[0]);
        await exit();
        await start();
        const restarted = await state();
        await page.waitForTimeout(950);
        assert.deepEqual(await state(), restarted);
        await exit();

        // One-question range must still complete after repeated wrong attempts.
        await page.evaluate(() => {
            toggleSelectAll({ checked: false });
            const parent = document.querySelector('input[name="level"][value="B1"]');
            const card = parent.closest('[data-level-card]');
            card.querySelector('input[name="lesson"][value="1"]').checked = true;
            syncParentFromChildren(card); updatePoolCount();
        });
        assert.equal(await page.locator('#wordPoolCount').innerText(), '1');
        await start();
        for (let i = 0; i < 2; i++) {
            await answer(i ? 'apple.' : 'appl');
            await page.locator('[onclick="proceedAfterFeedback()"]').click();
            assert.deepEqual((await state()).queue, ['apple']);
        }
        await answer(' APPLE '); await advance();
        assert.equal(await page.locator('#initialAccuracyScore').innerText(), '0%');
        assert.equal(await page.locator('#totalAttemptsValue').innerText(), '3 次');

        // Existing modes and level/lesson controls keep their original pools.
        await exit(); await mode('flashcard'); await all();
        assert.equal(await page.locator('#wordPoolCount').innerText(), '8');
        await start();
        assert.equal(await page.locator('#screenFlashcard').isVisible(), true);
        await page.evaluate(() => { flipCard(); nextFlashcard(); prevFlashcard(); });
        await exit();
        for (const value of ['en-ch', 'ch-en', 'cloze']) {
            await mode(value); await all(); await start();
            assert.equal(await page.locator('#optionsGrid').isVisible(), true);
            assert.equal(await page.locator('#spellingForm').isVisible(), false);
            assert.equal(await page.locator('#quizSpeakBtn').isVisible(), value === 'en-ch');
            const correctIndex = await page.evaluate(() => currentOptions.findIndex(x => x.word === quizQueue[0].word));
            await page.locator('.option-btn').nth(correctIndex).click();
            await page.waitForTimeout(850);
            assert.equal((await state()).attempts, 1);
            assert.equal((await state()).correct, 1);
            if (value === 'cloze') {
                assert.equal(await page.locator('input[name="level"][value="B1"]').isDisabled(), true);
                assert.equal(await page.locator('#wordPoolCount').innerText(), '3');
            }
            await exit();
        }
        // An old multiple-choice timer must not remove a new spelling question.
        await mode('en-ch'); await all(); await start();
        await page.evaluate(() => checkAnswer(currentOptions.findIndex(x => x.word === quizQueue[0].word)));
        await exit(); await mode('spelling'); await all(); await start();
        const afterModeSwitch = await state();
        await page.waitForTimeout(950);
        assert.deepEqual(await state(), afterModeSwitch);
        const spokenBefore = await page.evaluate(() => window.spokenWords.length);
        await page.evaluate(() => {
            currentMode = 'en-ch'; renderQuizQuestion(); exitToSetup();
            document.querySelector('input[name="mode"][value="spelling"]').checked = true;
            handleModeChange(); startAdventure();
        });
        await page.waitForTimeout(450);
        assert.equal(await page.evaluate(() => window.spokenWords.length), spokenBefore);
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 667 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        await page.locator('#spellingAnswer').fill('hello');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const inputBox = await page.locator('#spellingAnswer').boundingBox();
        const submitBox = await page.locator('#spellingSubmit').boundingBox();
        assert.ok(inputBox.width > 200 && submitBox.height >= 48);
        await page.screenshot({ path: process.env.SCREENSHOT_PATH || path.join(require('node:os').tmpdir(), 'english-spelling-mobile.png'), fullPage: true });
        // Every recovered format completes through the real UI, including a wrong
        // first answer, feedback, requeue, alternate spelling and unchanged scoring.
        await exit();
        const recovered = [
            { word: 'o’clock', translation: '點鐘', part_of_speech: 'adv.', answer: "O'CLOCK" },
            { word: 'a.m.', translation: '上午;凌晨', part_of_speech: 'adv.', answer: 'AM' },
            { word: 'p.m.', translation: '下午;晚上', part_of_speech: 'adv.', answer: 'PM' },
            { word: 'autumn / fall', translation: '秋天', part_of_speech: 'n.', answer: 'fall' },
            { word: 'everyone (everybody)', translation: '每個人;各位', part_of_speech: 'pron.', answer: 'everybody' },
            { word: 'though / although', translation: '雖然', part_of_speech: 'conj.', answer: 'although' },
            ...['Nice to meet you.', 'I see.', 'Guess what?', 'Hurry up.', 'Good job!', 'Excuse me.']
                .map(word => ({ word, translation: word, part_of_speech: 'phr.', answer: word.slice(0, -1) }))
        ];
        await page.evaluate(rows => {
            database = rows.map(({ answer, ...row }) => ({ ...row, level: 'B1', lesson: '1' }));
            renderLevelSelectors(); handleModeChange(); toggleSelectAll({ checked: true });
        }, recovered);
        assert.equal(await page.locator('#wordPoolCount').innerText(), '12');
        await start();
        for (let i = 0; i < recovered.length; i++) {
            const current = (await state()).queue[0];
            const item = recovered.find(row => row.word === current);
            if (current === 'a.m.' || current === 'p.m.') assert.match(await page.locator('#spellingHelp').innerText(), /時間縮寫/);
            if (current.includes('/') || current.includes('(')) assert.match(await page.locator('#spellingHelp').innerText(), /任一完整英文變體/);
            for (const width of [320, 375]) {
                await page.setViewportSize({ width, height: 667 });
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            }
            if (current === 'everyone (everybody)') {
                const screenshot = process.env.SCREENSHOT_PATH || path.join(require('node:os').tmpdir(), 'english-spelling-mobile.png');
                await page.screenshot({ path: screenshot.replace(/\.png$/, '-variants.png'), fullPage: true });
            }
            // Remove a letter from an otherwise accepted spelling.
            await answer(item.answer.slice(1));
            assert.equal(await page.locator('#feedbackBoard').isVisible(), true);
            assert.equal(await page.locator('#feedbackCorrectWord').innerText(), current);
            await page.locator('[onclick="proceedAfterFeedback()"]').click();
            assert.equal((await state()).queue.at(-1), current);
        }
        for (let i = 0; i < recovered.length; i++) {
            const current = (await state()).queue[0];
            await answer(` ${recovered.find(row => row.word === current).answer} `);
            await advance();
        }
        assert.equal(await page.locator('#initialAccuracyScore').innerText(), '0%');
        assert.equal(await page.locator('#totalAttemptsValue').innerText(), '24 次');
        assert.ok((await state()).histories.every(history => history.totalAttempts === 2));
        await page.evaluate(() => restartSameAdventure());
        assert.equal((await state()).attempts, 0);
        assert.equal((await state()).count, 12);
        for (let i = 0; i < recovered.length; i++) {
            const accepted = await page.evaluate(() => spellingAnswerSpec(quizQueue[0]).answers[0]);
            await answer(accepted.toUpperCase());
            await advance();
        }
        assert.equal(await page.locator('#initialAccuracyScore').innerText(), '100%');
        assert.equal(await page.locator('#totalAttemptsValue').innerText(), '12 次');
        await exit();
        await mode('flashcard'); await all(); await start();
        assert.equal(await page.locator('#screenFlashcard').isVisible(), true);
        assert.equal(await page.evaluate(() => database.length), 12);
        await exit(); await mode('spelling');
        // All-unsafe scopes must stay on setup and never create a zero-question quiz.
        await page.evaluate(() => {
            database = [{ word: 'may / might', translation: '可能;也許', part_of_speech: 'aux.', level: 'B1', lesson: '1' }];
            renderLevelSelectors(); handleModeChange(); startAdventure();
        });
        assert.equal(await page.locator('#wordPoolCount').innerText(), '0');
        assert.equal(await page.locator('#screenSetup').isVisible(), true);
        if (process.env.VOCAB_CSV) {
            const csv = fs.readFileSync(process.env.VOCAB_CSV, 'utf8');
            await page.evaluate(csv => {
                database = parseCSVToArray(csv);
                renderLevelSelectors(); handleModeChange(); toggleSelectAll({ checked: true });
            }, csv);
            const counts = await page.evaluate(() => ({ total: database.length, eligible: selectedWords.length }));
            assert.ok(counts.eligible > 0 && counts.eligible < counts.total);
            assert.equal(Number(await page.locator('#wordPoolCount').innerText()), counts.eligible);
            await start();
            const count = (await state()).count;
            for (let i = 0; i < count; i++) {
                const accepted = await page.evaluate(() => spellingAnswerSpec(quizQueue[0]).answers[0]);
                await answer(` ${accepted.toUpperCase()} `);
                await advance();
            }
            assert.equal(await page.locator('#initialAccuracyScore').innerText(), '100%');
            assert.equal(await page.locator('#totalAttemptsValue').innerText(), `${count} 次`);
            console.log(`CSV snapshot passed: ${counts.eligible}/${counts.total} eligible, ${count} questions completed.`);
        }
        assert.deepEqual(errors, []);
        console.log('Browser regression passed: spelling lifecycle, scoring, races, all four existing modes, ranges, 375px layout.');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
