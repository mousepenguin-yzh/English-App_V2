// Read-only audit against PR #7's conservative filter using a supplied CSV snapshot.
// node tests/audit-spelling.cjs path/to/snapshot.csv
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1], context);
const run = name => vm.runInContext(name, context);
const rows = run('parseCSVToArray')(fs.readFileSync(process.argv[2], 'utf8'));
const beforeData = JSON.stringify(rows);
const keys = item => run('spellingMeanings')(item).flatMap(meaning =>
    run('spellingPartsOfSpeech')(item).map(pos => JSON.stringify([meaning, pos])));
const answersByPrompt = new Map();
for (const item of rows) {
    const answers = run('spellingAnswerSpec')(item)?.answers || [run('normalizeSpellingAnswer')(item.word)];
    for (const key of keys(item)) {
        if (!answersByPrompt.has(key)) answersByPrompt.set(key, new Set());
        answers.forEach(answer => answersByPrompt.get(key).add(answer));
    }
}
const seen = new Set();
const before = rows.filter(item => {
    const spec = run('spellingAnswerSpec')(item);
    const prompts = keys(item);
    if (!spec || !prompts.length || prompts.some(key =>
        [...answersByPrompt.get(key)].some(answer => !spec.answers.includes(answer)))) return false;
    const key = run('getQuestionKey')({ ...item, word: run('normalizeSpellingAnswer')(item.word) });
    if (seen.has(key)) return false;
    seen.add(key); return true;
});
const after = Array.from(run('filterSpellingWords')(rows, rows));
const recovered = after.filter(item => !before.includes(item));
const removed = before.filter(item => !after.includes(item));
assert.equal(JSON.stringify(rows), beforeData, 'audit must not mutate source data');
assert.equal(removed.length, 0, 'snapshot unexpectedly loses formerly eligible rows');
console.log(JSON.stringify({ total: rows.length, before: before.length, after: after.length,
    recovered: recovered.map(item => ({ word: item.word, level: item.level, lesson: item.lesson,
        source: item.translation, ...run('spellingPromptSpec')(item) })), removed }, null, 2));
