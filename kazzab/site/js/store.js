// حفظ الحالة بالمتصفح — اللاعبين، النقاط، الإعدادات، والجولة الشغّالة.
// إذا التخزين مش متاح (تصفح خاص مثلاً) اللعبة بتضل شغّالة بالذاكرة.

const KEY = 'kazzab:v1';
export const TIMER_CHOICES = [0, 60, 120, 180, 300];

function blank() {
  return {
    v: 1,
    players: [], // {id, name, color}
    scores: {}, // id -> نقاط
    liarTimes: {}, // id -> كم مرة كان الكذّاب
    rounds: 0,
    settings: { cats: null, timer: 120, vote: 'secret', sound: true },
    custom: [],
    used: {}, // catId -> كلمات انلعبت
    lastCat: null,
    round: null,
  };
}

function clean(d) {
  const s = blank();
  if (!d || typeof d !== 'object') return s;
  if (Array.isArray(d.players)) {
    s.players = d.players
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p) => ({ id: p.id, name: p.name, color: String(p.color || '#ffd447') }));
  }
  const ids = new Set(s.players.map((p) => p.id));
  for (const key of ['scores', 'liarTimes']) {
    if (d[key] && typeof d[key] === 'object') {
      for (const [id, n] of Object.entries(d[key])) {
        if (ids.has(id) && Number.isFinite(n)) s[key][id] = n;
      }
    }
  }
  if (Number.isFinite(d.rounds)) s.rounds = d.rounds;
  const st = d.settings || {};
  if (Array.isArray(st.cats)) s.settings.cats = st.cats.filter((c) => typeof c === 'string');
  if (TIMER_CHOICES.includes(st.timer)) s.settings.timer = st.timer;
  if (st.vote === 'secret' || st.vote === 'open') s.settings.vote = st.vote;
  if (typeof st.sound === 'boolean') s.settings.sound = st.sound;
  if (Array.isArray(d.custom)) s.custom = d.custom.filter((w) => typeof w === 'string');
  if (d.used && typeof d.used === 'object') {
    for (const [id, list] of Object.entries(d.used)) {
      if (Array.isArray(list)) s.used[id] = list.filter((w) => typeof w === 'string');
    }
  }
  if (typeof d.lastCat === 'string') s.lastCat = d.lastCat;
  // جولة محفوظة بتنكمّل بس إذا كل لاعبيها لسا موجودين.
  const r = d.round;
  if (
    r && typeof r === 'object' && Array.isArray(r.order) && r.order.length >= 3 &&
    r.order.every((id) => ids.has(id)) && ids.has(r.liar) &&
    typeof r.word === 'string' && typeof r.catId === 'string' && typeof r.phase === 'string'
  ) {
    s.round = r;
  }
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return clean(raw ? JSON.parse(raw) : null);
  } catch {
    return blank();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* التخزين مش متاح — بنكمّل بدونه */
  }
}
