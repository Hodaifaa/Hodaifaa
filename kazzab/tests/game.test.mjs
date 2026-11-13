// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, QUESTION_IDEAS } from '../site/js/words.js';
import {
  GUESS_OPTIONS, MIN_WORDS, POINTS, shuffle, pickWord, guessOptions, askingPairs,
  tally, isCaught, scoreRound, cleanName, parseWords,
} from '../site/js/game.js';

const ids = ['a', 'b', 'c', 'd'];

test('word bank is clean', () => {
  const seenIds = new Set();
  let total = 0;
  for (const cat of CATEGORIES) {
    assert.ok(!seenIds.has(cat.id), `duplicate category id ${cat.id}`);
    seenIds.add(cat.id);
    assert.ok(cat.name && cat.emoji);
    assert.ok(cat.words.length >= 30, `${cat.id} needs at least 30 words, has ${cat.words.length}`);
    assert.equal(new Set(cat.words).size, cat.words.length, `duplicate word in ${cat.id}`);
    for (const w of cat.words) {
      assert.equal(w, w.trim());
      assert.ok(w.length >= 2 && w.length <= 30, `bad word length: "${w}"`);
    }
    total += cat.words.length;
  }
  assert.ok(total >= 600);
  assert.equal(CATEGORIES.filter((c) => c.spicy).length, 1);
  assert.equal(new Set(QUESTION_IDEAS).size, QUESTION_IDEAS.length);
});

test('shuffle keeps every item', () => {
  const out = shuffle([1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
});

test('pickWord never repeats a word until the category runs out', () => {
  const cats = [{ id: 'x', words: ['1', '2', '3', '4', '5'] }];
  const used = {};
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const c = pickWord(cats, used, null);
    assert.ok(!seen.includes(c.word));
    seen.push(c.word);
    used.x = c.used;
  }
  const again = pickWord(cats, used, null);
  assert.ok(cats[0].words.includes(again.word));
  assert.deepEqual(again.used, [again.word]);
});

test('pickWord avoids the previous category and skips tiny ones', () => {
  const cats = [
    { id: 'x', words: ['1', '2', '3', '4'] },
    { id: 'y', words: ['5', '6', '7', '8'] },
    { id: 'tiny', words: ['9'] },
  ];
  for (let i = 0; i < 50; i++) assert.equal(pickWord(cats, {}, 'x').catId, 'y');
  assert.equal(pickWord([cats[0]], {}, 'x').catId, 'x');
  assert.equal(pickWord([cats[2]], {}, null), null);
  assert.equal(MIN_WORDS, 4);
});

test('guess options always include the secret, with no duplicates', () => {
  for (const cat of CATEGORIES) {
    const secret = cat.words[3];
    const opts = guessOptions(cat.words, secret);
    assert.equal(opts.length, GUESS_OPTIONS);
    assert.ok(opts.includes(secret));
    assert.equal(new Set(opts).size, opts.length);
  }
  assert.equal(guessOptions(['a', 'b', 'c', 'd'], 'a').length, 4);
});

test('everyone asks once and is asked once, never themselves', () => {
  for (let i = 0; i < 30; i++) {
    const pairs = askingPairs(ids);
    assert.deepEqual(pairs.map((p) => p[0]).sort(), ids);
    assert.deepEqual(pairs.map((p) => p[1]).sort(), ids);
    assert.ok(pairs.every(([a, b]) => a !== b));
  }
});

test('tally counts votes and finds the top', () => {
  const t = tally(ids, { a: 'd', b: 'd', c: 'a', d: 'a', ghost: 'a' });
  assert.deepEqual(t.counts, { a: 2, b: 0, c: 0, d: 2 });
  assert.equal(t.max, 2);
  assert.deepEqual(t.top, ['a', 'd']);
  assert.deepEqual(tally(ids, {}).top, []);
});

test('liar is caught only with the clear most votes', () => {
  const base = { voteMode: 'secret', liar: 'd', word: 'w' };
  assert.equal(isCaught({ ...base, votes: { a: 'd', b: 'd', c: 'a', d: 'a' } }, ids), false); // tie
  assert.equal(isCaught({ ...base, votes: { a: 'd', b: 'd', c: 'd', d: 'a' } }, ids), true);
  assert.equal(isCaught({ ...base, votes: { a: 'b', b: 'a', c: 'b', d: 'b' } }, ids), false);
  assert.equal(isCaught({ voteMode: 'open', liar: 'd', accused: 'd' }, ids), true);
  assert.equal(isCaught({ voteMode: 'open', liar: 'd', accused: null }, ids), false);
});

test('scoring: secret vote', () => {
  const r = { voteMode: 'secret', liar: 'd', word: 'w', guess: 'w', votes: { a: 'd', b: 'c', c: 'd', d: 'a' } };
  const s = scoreRound(r, ids);
  assert.equal(s.caught, true);
  assert.equal(s.guessed, true);
  assert.equal(s.points.a.total, POINTS.vote);
  assert.equal(s.points.b.total, 0);
  assert.equal(s.points.c.total, POINTS.vote);
  assert.equal(s.points.d.total, POINTS.guess);
  assert.deepEqual(s.points.d.why, ['guess']);
});

test('scoring: liar escapes and misses the word', () => {
  const r = { voteMode: 'secret', liar: 'd', word: 'w', guess: 'x', votes: { a: 'b', b: 'a', c: 'd', d: 'a' } };
  const s = scoreRound(r, ids);
  assert.equal(s.caught, false);
  assert.equal(s.points.d.total, POINTS.escape);
  assert.equal(s.points.c.total, POINTS.vote); // voted right even though the group missed
  assert.equal(s.points.a.total, 0);
});

test('scoring: open vote', () => {
  const hit = scoreRound({ voteMode: 'open', liar: 'd', accused: 'd', word: 'w', guess: 'x', votes: {} }, ids);
  assert.deepEqual(['a', 'b', 'c', 'd'].map((id) => hit.points[id].total), [1, 1, 1, 0]);
  const miss = scoreRound({ voteMode: 'open', liar: 'd', accused: 'a', word: 'w', guess: 'w', votes: {} }, ids);
  assert.deepEqual(['a', 'b', 'c', 'd'].map((id) => miss.points[id].total), [0, 0, 0, POINTS.escape + POINTS.guess]);
});

test('input cleaning', () => {
  assert.equal(cleanName('  أبو   الليل  '), 'أبو الليل');
  assert.equal(cleanName('x'.repeat(40)).length, 16);
  assert.equal(cleanName(null), '');
  assert.deepEqual(parseWords('منسف\n منسف \nكبسة، برغر,بيتزا\n\n'), ['منسف', 'كبسة', 'برغر', 'بيتزا']);
  assert.equal(parseWords(Array.from({ length: 300 }, (_, i) => `w${i}`).join('\n')).length, 200);
});
