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
const word = (answer, translation = '測試', pos = 'n.', extra = {}) => ({
    word: answer, translation, part_of_speech: pos, level: 'B1', lesson: '1', ...extra
});
const eligible = (rows, all = rows) => Array.from(filter(rows, all), item => item.word);

test('only case and outer whitespace are ignored', () => {
    assert.equal(normalize(' \tApPle\n'), 'apple');
    for (const [correct, wrong] of [["don't", 'dont'], ['ice cream', 'ice  cream'],
        ['ice cream', 'ice-cream'], ['well-known', 'well known'], ['apple', 'appl'],
        ["don't", 'don’t'], ['apple', 'apple.']]) {
        assert.notEqual(normalize(correct), normalize(wrong));
    }
    assert.equal(normalize(' \n\t'), '');
});

test('ordinary phrases, apostrophes and hyphens remain eligible', () => {
    for (const answer of ['apple', 'PE', "don't", 'ice cream', 'well-known']) {
        assert.deepEqual(eligible([word(answer)]), [answer]);
    }
});

test('alternative answers, placeholders and unclear punctuation are excluded', () => {
    for (const answer of ['autumn / fall', 'everyone (everybody)', 'year(s) old',
        'show ... around', 'as…as…', 'Mr.', 'p.m.', 'Good job!', 'o’clock',
        '-free', 'ice  cream', '', ' ', 'apple\tpie', '123']) {
        assert.deepEqual(eligible([word(answer)]), [], answer);
    }
    assert.deepEqual(eligible([word('apple', ''), word('pear', '梨', '')]), []);
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
