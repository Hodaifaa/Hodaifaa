// منطق اللعبة الصافي — بدون DOM، عشان ينفحص لحاله.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MIN_WORDS = 4; // أقل عدد كلمات عشان الفئة تنلعب
export const GUESS_OPTIONS = 8;
export const POINTS = { vote: 1, escape: 2, guess: 2 };

export function shuffle(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

// بيختار فئة (غير فئة الجولة اللي قبل إذا في غيرها) وكلمة ما انلعبت قبل.
// بيرجّع قائمة "المستعمل" الجديدة لهاي الفئة.
export function pickWord(cats, used = {}, lastCatId = null, rng = Math.random) {
  const playable = cats.filter((c) => c.words.length >= MIN_WORDS);
  if (!playable.length) return null;
  const fresh = playable.filter((c) => c.id !== lastCatId);
  const cat = pick(fresh.length ? fresh : playable, rng);
  const seen = new Set(used[cat.id] || []);
  let pool = cat.words.filter((w) => !seen.has(w));
  let usedNow = [...seen].filter((w) => cat.words.includes(w));
  if (!pool.length) {
    pool = cat.words.slice();
    usedNow = [];
  }
  const word = pick(pool, rng);
  return { catId: cat.id, word, used: [...usedNow, word] };
}

// خيارات الكذّاب لما يحزر: الكلمة الصح + كلمات من نفس الفئة.
export function guessOptions(words, secret, n = GUESS_OPTIONS, rng = Math.random) {
  const others = shuffle(words.filter((w) => w !== secret), rng).slice(0, n - 1);
  return shuffle([secret, ...others], rng);
}

// حلقة أسئلة: كل لاعب بيسأل مرة وبينسأل مرة.
export function askingPairs(ids, rng = Math.random) {
  const o = shuffle(ids, rng);
  return o.map((id, i) => [id, o[(i + 1) % o.length]]);
}

export function tally(ids, votes = {}) {
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  const voters = Object.fromEntries(ids.map((id) => [id, []]));
  for (const [voter, target] of Object.entries(votes)) {
    if (target in counts && voter in counts) {
      counts[target]++;
      voters[target].push(voter);
    }
  }
  const max = Math.max(0, ...Object.values(counts));
  const top = max > 0 ? ids.filter((id) => counts[id] === max) : [];
  return { counts, voters, max, top };
}

// الكذّاب بينمسك بس إذا أخذ أكثر أصوات لحاله (التعادل لصالحه).
export function isCaught(round, ids) {
  if (round.voteMode === 'open') return round.accused === round.liar;
  const t = tally(ids, round.votes);
  return t.top.length === 1 && t.top[0] === round.liar;
}

export function scoreRound(round, ids) {
  const caught = isCaught(round, ids);
  const guessed = round.guess === round.word;
  const points = Object.fromEntries(ids.map((id) => [id, { total: 0, why: [] }]));
  const give = (id, key) => {
    points[id].total += POINTS[key];
    points[id].why.push(key);
  };
  for (const id of ids) {
    if (id === round.liar) continue;
    const hit = round.voteMode === 'open' ? caught : round.votes[id] === round.liar;
    if (hit) give(id, 'vote');
  }
  if (!caught) give(round.liar, 'escape');
  if (guessed) give(round.liar, 'guess');
  return { caught, guessed, points };
}

export function cleanName(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

export function parseWords(raw) {
  const seen = new Set();
  const out = [];
  for (const part of String(raw ?? '').split(/[\n,،؛;]+/)) {
    const w = part.replace(/\s+/g, ' ').trim().slice(0, 30);
    if (w && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
    if (out.length >= 200) break;
  }
  return out;
}
