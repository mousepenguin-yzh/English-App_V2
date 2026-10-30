const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1], context);
const normalize = vm.runInContext('normalizeSpellingAnswer', context);
const filter = vm.runInContext('filterSpellingWords', context);
const parse = vm.runInContext('parseCSVToArray', context);
const spec = vm.runInContext('spellingAnswerSpec', context);
const correct = vm.runInContext('isCorrectSpellingAnswer', context);
const word = (answer, translation = '測試', pos = 'n.', extra = {}) => ({
    word: answer, translation, part_of_speech: pos, level: 'B1', lesson: '1', ...extra
});
const eligible = (rows, all = rows) => Array.from(filter(rows, all), item => item.word);

test('normalization only folds case, outer whitespace and curly apostrophes', () => {
    assert.equal(normalize(' \tApPle\n'), 'apple');
    for (const [correct, wrong] of [["don't", 'dont'], ['ice cream', 'ice  cream'],
        ['ice cream', 'ice-cream'], ['well-known', 'well known'], ['apple', 'appl'],
        ['apple', 'apple.']]) {
        assert.notEqual(normalize(correct), normalize(wrong));
    }
    assert.equal(normalize(' \n\t'), '');
    assert.equal(normalize(' DON’T '), "don't");
    assert.equal(normalize('o‘clock'), "o'clock");
});

test('ordinary phrases, apostrophes and hyphens remain eligible', () => {
    for (const answer of ['apple', 'PE', "don't", 'ice cream', 'well-known']) {
        assert.deepEqual(eligible([word(answer)]), [answer]);
    }
});

test('alternative answers, placeholders and unclear punctuation are excluded', () => {
    for (const answer of ['may / might', 'will / would', 'tell / told... from...', 'year(s) old',
        'show ... around', 'as…as…', 'Mr.', 'p.m.', 'Good job!',
        '-free', 'ice  cream', '', ' ', 'apple\tpie', '123']) {
        assert.deepEqual(eligible([word(answer)]), [], answer);
    }
    assert.deepEqual(eligible([word('apple', ''), word('pear', '梨', '')]), []);
});

test('reviewed alternatives require the confirmed complete prompt and accept only complete answers', () => {
    for (const [answer, translation, pos, accepted] of [
        ['autumn / fall', '秋天', 'n.', ['autumn', 'fall']],
        ['everyone (everybody)', '每個人;各位', 'pron.', ['everyone', 'everybody']],
        ['though / although', '雖然', 'conj.', ['though', 'although']]
    ]) {
        const item = word(answer, translation, pos);
        assert.deepEqual(eligible([item]), [answer]);
        for (const spelling of accepted) assert.equal(correct(item, ` ${spelling.toUpperCase()} `), true);
        for (const spelling of [answer, accepted[0].slice(0, -1), accepted.join(' '), 'other']) {
            assert.equal(correct(item, spelling), false, spelling);
        }
        assert.deepEqual(eligible([word(answer, '不同意思', pos)]), []);
        assert.deepEqual(eligible([word(answer, translation, 'v.')]), []);
    }
    for (const answer of ['cat / dog', 'happy (glad)', 'may / might', 'will / would']) {
        assert.equal(spec(word(answer)), null);
    }
});

test('time abbreviations need their reviewed prompt and only allow all dots or none', () => {
    for (const [answer, translation] of [['a.m.', '上午;凌晨'], ['p.m.', '下午;晚上']]) {
        const item = word(answer, translation, 'adv.');
        assert.deepEqual(eligible([item]), [answer]);
        assert.match(spec(item).help, /時間縮寫/);
        for (const spelling of [answer, answer.replaceAll('.', '').toUpperCase()]) assert.equal(correct(item, spelling), true);
        for (const spelling of ['a.m', 'p.m', 'a m', 'p m', 'pm.', 'am.', 'morning', 'afternoon', 'p.n.', 'a.n.']) {
            assert.equal(correct(item, spelling), false, spelling);
        }
        assert.equal(spec(word(answer, '其他提示', 'adv.')), null);
    }
    assert.equal(spec(word('Mr.', '先生', 'n.')), null);
});

test('curly apostrophes remain mandatory and fixed sentences only allow their original terminal mark or none', () => {
    const clock = word('o’clock', '點鐘', 'adv.');
    assert.deepEqual(eligible([clock]), ['o’clock']);
    for (const answer of ["o'clock", 'o’clock', ' O’CLOCK ']) assert.equal(correct(clock, answer), true);
    for (const answer of ['oclock', 'o clock', "o'clok", 'o”clock']) assert.equal(correct(clock, answer), false);
    for (const answer of ['Nice to meet you.', 'I see.', 'Guess what?', 'Hurry up.', 'Good job!', 'Excuse me.']) {
        const item = word(answer, '固定句子', 'phr.');
        assert.deepEqual(eligible([item]), [answer]);
        assert.equal(correct(item, answer), true);
        assert.equal(correct(item, answer.slice(0, -1)), true);
        for (const wrong of [answer + answer.at(-1), answer.slice(0, -2), answer.replace(' ', '  '), answer.slice(0, -1) + ';']) {
            assert.equal(correct(item, wrong), false, wrong);
        }
    }
    for (const answer of ['What about...?', 'turn (...) into...', 'Hello!!', 'I see..', 'Good, job!', 'apple.']) {
        assert.equal(spec(word(answer, '提示', 'phr.')), null);
    }
    assert.equal(correct(word('apple'), 'apple.'), false);
    assert.equal(correct(word("don't"), 'dont'), false);
});

test('accepted sets participate in full-database ambiguity checks without broad synonym recovery', () => {
    const alternate = word('autumn / fall', '秋天');
    const fall = word('fall', '秋天', 'n.', { level: 'B6' });
    assert.deepEqual(eligible([alternate, fall]), ['autumn / fall']);
    assert.deepEqual(eligible([alternate], [alternate, word('season', '秋天')]), []);
    assert.deepEqual(eligible([alternate], [alternate, word('autumn / winter', '秋天')]), []);
    const clock = word('o’clock', '點鐘', 'adv.');
    assert.deepEqual(eligible([clock], [clock, word("o'clock", '點鐘', 'adv.', { level: 'B6' })]), ['o’clock']);
    const sentence = word('Good job!', '做得好!', 'phr.');
    assert.deepEqual(eligible([sentence], [sentence, word('Well done!', '做得好!', 'phr.')]), []);
    const before = JSON.stringify([alternate, fall]);
    filter([alternate, fall], [alternate, fall]);
    assert.equal(JSON.stringify([alternate, fall]), before);
});

test('overlapping meanings and POS are excluded across the entire database', () => {
    const rows = [word('beautiful', '美麗的;漂亮的', 'adj.'),
        word('pretty', '漂亮的；可愛的', 'adj.', { level: 'B6', lesson: '9' })];
    assert.deepEqual(eligible(rows), []);
    assert.deepEqual(eligible([rows[0]], rows), []);
    assert.deepEqual(eligible([word('mark', '目標', 'n. / v.'), word('target', '目標', 'v.')]), []);
});

test('unsafe alternative rows still disqualify conflicting prompts', () => {
    assert.deepEqual(eligible([word('fall', '秋天')],
        [word('fall', '秋天'), word('autumn / fall', '秋天')]), []);
});

test('distinct POS or meanings remain available, exact duplicates deduplicate without mutation', () => {
    const rows = [word('watch', '手錶'), word('watch', '觀看', 'v.'),
        word('WATCH', '手錶'), word('clock', '時鐘')];
    const before = JSON.stringify(rows);
    assert.deepEqual(eligible(rows), ['watch', 'watch', 'clock']);
    assert.equal(JSON.stringify(rows), before);
    assert.equal(eligible([word('apple'), word('apple', '測試', 'n.', { lesson: '2' })]).length, 2);
});

test('CSV optional lesson, quoted fields and original word formats remain unchanged', () => {
    const rows = parse('word,translation,part_of_speech,level,lesson\r\n"autumn / fall","秋天,秋季",n.,B1\r\napple,蘋果,n.,B1, 2 ');
    assert.equal(rows[0].word, 'autumn / fall');
    assert.equal(rows[0].translation, '秋天,秋季');
    assert.equal(rows[0].lesson, '');
    assert.equal(rows[1].lesson, '2');
    assert.deepEqual(eligible(rows), ['apple']);
});
