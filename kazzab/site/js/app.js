import { CATEGORIES, QUESTION_IDEAS } from './words.js';
import {
  MIN_PLAYERS, MAX_PLAYERS, MIN_WORDS, POINTS, shuffle, pick, pickWord, guessOptions,
  askingPairs, tally, isCaught, scoreRound, cleanName, parseWords,
} from './game.js';
import { load, save, TIMER_CHOICES } from './store.js';
import { sfx, buzz, setSound } from './sfx.js';
import { h, icon, toast, openSheet, closeSheet, hasSheet, confirmSheet } from './dom.js';

const COLORS = [
  '#e3b23c', '#d9785a', '#efe6d2', '#7fb2c4', '#9dbb8a', '#d99aa0',
  '#c98f3a', '#5fa89c', '#b3a0c9', '#c25a4a', '#d8c39a', '#a9a85a',
];
const MEDALS = ['🥇', '🥈', '🥉'];
const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const root = document.getElementById('app');
const S = load();
setSound(S.settings.sound);

// حالة مؤقتة للواجهة (ما بتنحفظ): مين ماسك التلفون هسا، وأي شاشة جانبية مفتوحة.
const ui = { view: 'home', ready: false, repeek: null, unmasked: false };

// ——————————————————— أدوات صغيرة ———————————————————

const commit = () => save(S);
const byId = (id) => S.players.find((p) => p.id === id);
const nameOf = (id) => byId(id)?.name ?? '؟';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function plural(n, [one, two, few, many]) {
  if (n === 1) return one;
  if (n === 2) return two;
  const m = n % 100;
  return `${n} ${m >= 3 && m <= 10 ? few : many}`;
}
const playersWord = (n) => plural(n, ['لاعب واحد', 'لاعبين', 'لاعبين', 'لاعب']);
const wordsWord = (n) => plural(n, ['كلمة', 'كلمتين', 'كلمات', 'كلمة']);
const roundsWord = (n) => plural(n, ['جولة وحدة', 'جولتين', 'جولات', 'جولة']);
const timesWord = (n) => plural(n, ['مرة وحدة', 'مرتين', 'مرات', 'مرة']);
const votesWord = (n) => plural(n, ['صوت واحد', 'صوتين', 'أصوات', 'صوت']);
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function allCats() {
  return [...CATEGORIES, { id: 'custom', name: 'كلماتي', emoji: '✍️', words: S.custom, custom: true }];
}
const catById = (id) => allCats().find((c) => c.id === id);

function selectedIds() {
  const valid = new Set(allCats().map((c) => c.id));
  const picked = S.settings.cats ?? CATEGORIES.map((c) => c.id);
  return picked.filter((id) => valid.has(id));
}
function playableCats() {
  const sel = new Set(selectedIds());
  return allCats().filter((c) => sel.has(c.id) && c.words.length >= MIN_WORDS);
}
function setSelected(set) {
  S.settings.cats = allCats().map((c) => c.id).filter((id) => set.has(id));
}

function avatar(p, size = '') {
  return h('span', { class: `avatar ${size}`, style: { '--c': p.color }, 'aria-hidden': 'true' },
    [...p.name.trim()][0] ?? '؟');
}

function dots(i, n) {
  return h('div', { class: 'dots', role: 'img', 'aria-label': `${i + 1} من ${n}` },
    Array.from({ length: n }, (_, k) => h('span', { class: k < i ? 'dot done' : k === i ? 'dot now' : 'dot' })));
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  buzz(40);
}

// ——————————————————— التنقّل ———————————————————

let cleanups = [];
const onLeave = (fn) => cleanups.push(fn);

function render() {
  cleanups.splice(0).forEach((fn) => fn());
  const screen = route();
  root.replaceChildren(screen);
  window.scrollTo(0, 0);
  screen.querySelector('[data-focus]')?.focus({ preventScroll: true });
  keepAwake(!!S.round);
}

function route() {
  const r = S.round;
  if (!r) return ui.view === 'board' ? Board() : Home();
  if (ui.repeek) return ui.repeek.open ? Peek(byId(ui.repeek.id), true) : PassAgain();
  if (r.phase === 'reveal') return ui.ready ? Peek(byId(r.order[r.idx]), false) : PassReveal();
  if (r.phase === 'talk') return Talk();
  if (r.phase === 'vote') {
    if (r.voteMode === 'open') return OpenVote();
    return ui.ready ? Vote() : PassVote();
  }
  if (r.phase === 'result') {
    if (r.step === 'tally') return Tally();
    if (r.step === 'unmask') return Unmask();
    if (r.step === 'guess') return Guess();
    if (r.step === 'summary' && r.result) return Summary();
  }
  S.round = null;
  commit();
  return Home();
}

// الشاشة ما تطفي والتلفون بيلف بين الإيدين.
let wake = null;
async function keepAwake(want) {
  try {
    if (want && !wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    } else if (!want && wake) {
      await wake.release();
      wake = null;
    }
  } catch {
    wake = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepAwake(!!S.round);
});

// زر الرجوع بالتلفون: بيسكّر النافذة أو بيسأل قبل ما يوقف الجولة، بدل ما يطلع من اللعبة.
let guard = false;
function armBack() {
  if (guard) return;
  try {
    history.pushState({ kazzab: 1 }, '');
    guard = true;
  } catch {
    /* مش مهم */
  }
}
window.addEventListener('popstate', () => {
  guard = false;
  if (hasSheet()) {
    closeSheet();
    armBack();
  } else if (S.round) {
    armBack();
    quitRound();
  } else if (ui.view === 'board') {
    ui.view = 'home';
    render();
  }
});

function sheet(options) {
  armBack();
  return openSheet(options);
}

async function quitRound() {
  if (hasSheet()) return;
  armBack();
  const finished = S.round?.result;
  const ok = finished || await confirmSheet({
    title: 'نوقف الجولة؟',
    text: 'الجولة الحالية بتنلغى. النقاط من الجولات اللي قبل بتضل محفوظة.',
    yes: 'أيوه، وقّفها',
    no: 'لا، نكمّل',
    danger: true,
  });
  if (!ok) return;
  leaveRound('home');
}

function leaveRound(view) {
  S.round = null;
  ui.ready = false;
  ui.repeek = null;
  ui.unmasked = false;
  ui.view = view;
  commit();
  render();
}

// ——————————————————— بداية الجولة ———————————————————

function startRound() {
  if (S.players.length < MIN_PLAYERS) return toast('بدكم 3 لاعبين عالأقل');
  const cats = playableCats();
  const choice = pickWord(cats, S.used, S.lastCat);
  if (!choice) return toast('اختاروا فئة وحدة عالأقل');
  const cat = cats.find((c) => c.id === choice.catId);
  S.used[choice.catId] = choice.used;
  S.lastCat = choice.catId;

  const ids = S.players.map((p) => p.id);
  const shift = S.rounds % ids.length; // كل جولة بيبدأ لاعب غير
  S.round = {
    n: S.rounds + 1,
    catId: choice.catId,
    word: choice.word,
    liar: pick(ids),
    order: [...ids.slice(shift), ...ids.slice(0, shift)],
    phase: 'reveal',
    idx: 0,
    pairs: askingPairs(ids),
    pairIdx: 0,
    timer: null,
    voteMode: S.settings.vote,
    votes: {},
    accused: null,
    options: guessOptions(cat.words, choice.word),
    guess: null,
    step: null,
    result: null,
  };
  ui.ready = false;
  ui.repeek = null;
  ui.unmasked = false;
  ui.view = 'home';
  commit();
  armBack();
  sfx.next();
  render();
}

function roundBar() {
  const r = S.round;
  const cat = catById(r.catId);
  return h('header', { class: 'bar' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'إنهاء الجولة', onclick: quitRound }, icon('x', 22)),
    h('div', { class: 'bar-mid' },
      h('span', { class: 'pill' }, `جولة ${r.n}`),
      cat && h('span', { class: 'pill pill-cat' }, cat.name),
    ),
    h('span', { class: 'bar-space' }),
  );
}

// ——————————————————— الرئيسية ———————————————————

function Home() {
  const count = h('span', { class: 'sec-meta' });
  const list = h('ul', { class: 'chips' });
  const input = h('input', {
    class: 'input', type: 'text', placeholder: 'اسم اللاعب', maxlength: '16',
    autocomplete: 'off', enterkeyhint: 'done', 'aria-label': 'اسم اللاعب',
  });
  const form = h('form', { class: 'add-row', onsubmit: addPlayer },
    input,
    h('button', { class: 'btn btn-add', type: 'submit', 'aria-label': 'ضيف اللاعب' }, icon('plus', 26)),
  );
  const catGrid = h('div', { class: 'cats' });
  const allBtn = h('button', { class: 'link-btn', type: 'button', onclick: toggleAll });
  const voteNote = h('p', { class: 'muted small' });
  const note = h('p', { class: 'foot-note', role: 'status' });
  const cta = h('button', { class: 'btn btn-lg', type: 'button', onclick: startRound }, 'يلا نلعب');

  function drawPlayers(newId) {
    count.textContent = `${S.players.length} / ${MAX_PLAYERS}`;
    list.replaceChildren(...(S.players.length
      ? S.players.map((p) => h('li', { class: p.id === newId ? 'chip chip-new' : 'chip' },
        avatar(p, 'sm'),
        h('span', { class: 'chip-name' }, p.name),
        h('button', {
          class: 'chip-x', type: 'button', 'aria-label': `شيل ${p.name}`, onclick: () => removePlayer(p.id),
        }, icon('x', 16)),
      ))
      : [h('li', { class: 'empty' }, 'اكتب أسماء اللي قاعدين معك — 3 عالأقل')]));
    const full = S.players.length >= MAX_PLAYERS;
    input.disabled = full;
    input.placeholder = full ? 'اكتمل العدد' : 'اسم اللاعب';
  }

  function addPlayer(e) {
    e.preventDefault();
    const name = cleanName(input.value);
    if (!name) return shake(form);
    if (S.players.length >= MAX_PLAYERS) return toast(`الحد الأقصى ${MAX_PLAYERS} لاعب`);
    if (S.players.some((p) => p.name === name)) {
      shake(form);
      return toast('الاسم موجود — ميّزوه بلقب');
    }
    const taken = new Set(S.players.map((p) => p.color));
    const color = COLORS.find((c) => !taken.has(c)) ?? COLORS[S.players.length % COLORS.length];
    const id = uid();
    S.players.push({ id, name, color });
    commit();
    input.value = '';
    sfx.add();
    drawPlayers(id);
    drawFoot();
    input.focus();
  }

  function removePlayer(id) {
    S.players = S.players.filter((p) => p.id !== id);
    delete S.scores[id];
    delete S.liarTimes[id];
    commit();
    sfx.remove();
    drawPlayers();
    drawFoot();
  }

  function drawCats() {
    const sel = new Set(selectedIds());
    allBtn.textContent = CATEGORIES.every((c) => sel.has(c.id)) ? 'شيل الكل' : 'اختار الكل';
    catGrid.replaceChildren(...allCats().map((c) => {
      const ready = c.words.length >= MIN_WORDS;
      const row = h('button', {
        class: `cat${c.custom ? ' cat-custom' : ''}`,
        type: 'button',
        role: 'checkbox',
        'aria-checked': String(sel.has(c.id) && ready),
        onclick: () => toggleCat(c),
      },
        h('span', { class: 'cat-box', 'aria-hidden': 'true' }, icon('check', 14)),
        h('span', { class: 'cat-name' }, c.name, c.spicy && h('span', { class: 'cat-tag' }, '+18')),
        h('span', { class: 'cat-dots', 'aria-hidden': 'true' }),
        h('span', { class: 'cat-count' }, c.custom && !ready ? 'ضيف' : String(c.words.length)),
      );
      if (!c.custom || !ready) return row;
      return h('div', { class: 'cat-wrap' }, row,
        h('button', { class: 'cat-edit', type: 'button', 'aria-label': 'عدّل كلماتي', onclick: editCustom }, icon('edit', 16)));
    }));
  }

  function toggleCat(c) {
    if (c.custom && c.words.length < MIN_WORDS) return editCustom();
    const sel = new Set(selectedIds());
    if (sel.has(c.id)) sel.delete(c.id);
    else sel.add(c.id);
    setSelected(sel);
    commit();
    sfx.tap();
    drawCats();
    drawFoot();
  }

  function toggleAll() {
    const sel = new Set(selectedIds());
    const base = CATEGORIES.map((c) => c.id);
    const allOn = base.every((id) => sel.has(id));
    base.forEach((id) => (allOn ? sel.delete(id) : sel.add(id)));
    setSelected(sel);
    commit();
    sfx.tap();
    drawCats();
    drawFoot();
  }

  function editCustom() {
    const area = h('textarea', { class: 'input area', rows: '7', placeholder: 'منسف\nالبترا\nخالي أبو سمير…', 'aria-label': 'كلماتك' });
    area.value = S.custom.join('\n');
    const close = sheet({
      title: 'كلماتي',
      body: [
        h('p', { class: 'sheet-text' }, `كلمة بكل سطر، ${MIN_WORDS} عالأقل. خلّوها من نفس الجو (أسماء العيلة، نكت الشلّة، أماكنكم) عشان الكذّاب يقدر يمثّل.`),
        area,
      ],
      actions: [
        h('button', {
          class: 'btn', type: 'button', onclick: () => {
            S.custom = parseWords(area.value);
            delete S.used.custom;
            const sel = new Set(selectedIds());
            if (S.custom.length >= MIN_WORDS) sel.add('custom');
            else sel.delete('custom');
            setSelected(sel);
            commit();
            close();
            toast(S.custom.length >= MIN_WORDS ? `انحفظت ${wordsWord(S.custom.length)}` : `بدّك ${MIN_WORDS} كلمات عالأقل`);
            drawCats();
            drawFoot();
          },
        }, 'حفظ'),
      ],
    });
  }

  function drawVoteNote() {
    voteNote.textContent = S.settings.vote === 'secret'
      ? 'كل لاعب بيصوّت لحاله عالتلفون، والنقاط لكل واحد حسب صوته.'
      : 'بتأشّروا كلكم مع بعض وبتختاروا المتّهم — أسرع للقعدات الكبيرة.';
  }

  function drawFoot() {
    const missing = MIN_PLAYERS - S.players.length;
    const cats = playableCats();
    let msg = '';
    if (missing >= 3) msg = 'ضيفوا 3 لاعبين عالأقل';
    else if (missing === 2) msg = 'ناقص لاعبين';
    else if (missing === 1) msg = 'ناقص لاعب واحد';
    else if (!cats.length) msg = 'اختاروا فئة وحدة عالأقل';
    cta.disabled = !!msg;
    note.textContent = msg || `${playersWord(S.players.length)} · ${wordsWord(cats.reduce((n, c) => n + c.words.length, 0))}`;
  }

  const soundBtn = h('button', { class: 'icon-btn', type: 'button', onclick: toggleSound });
  function drawSound() {
    soundBtn.replaceChildren(icon(S.settings.sound ? 'sound' : 'mute', 22));
    soundBtn.setAttribute('aria-label', S.settings.sound ? 'الصوت شغّال — اضغط للكتم' : 'الصوت مكتوم — اضغط للتشغيل');
  }
  function toggleSound() {
    S.settings.sound = !S.settings.sound;
    setSound(S.settings.sound);
    commit();
    drawSound();
    sfx.tap();
  }

  drawPlayers();
  drawCats();
  drawVoteNote();
  drawFoot();
  drawSound();

  return h('section', { class: 'screen home' },
    h('header', { class: 'bar' },
      h('div', { class: 'tools' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'كيف نلعب؟', onclick: howTo }, icon('help', 22)),
        soundBtn,
        S.rounds > 0 && h('button', {
          class: 'icon-btn', type: 'button', 'aria-label': 'لوحة النتائج',
          onclick: () => { ui.view = 'board'; armBack(); render(); },
        }, icon('trophy', 22)),
      ),
    ),
    h('div', { class: 'hero' },
      h('h1', { class: 'display logo', tabindex: '-1', 'data-focus': '' }, 'الكذّاب'),
      h('p', { class: 'tagline' }, 'كلكم بتعرفوا الكلمة… إلا واحد. اكشفوه قبل ما يحزرها!'),
    ),
    h('section', { class: 'sec' },
      h('div', { class: 'sec-head' }, h('h2', { class: 'sec-title' }, 'اللاعبين'), count),
      list,
      form,
    ),
    h('section', { class: 'sec' },
      h('div', { class: 'sec-head' }, h('h2', { class: 'sec-title' }, 'الفئات'), allBtn),
      catGrid,
    ),
    h('section', { class: 'sec' },
      h('div', { class: 'sec-head' }, h('h2', { class: 'sec-title' }, 'وقت النقاش')),
      segmented('وقت النقاش',
        TIMER_CHOICES.map((v) => ({ value: v, label: v ? `${v / 60} د` : 'مفتوح' })),
        S.settings.timer,
        (v) => { S.settings.timer = v; commit(); }),
    ),
    h('section', { class: 'sec' },
      h('div', { class: 'sec-head' }, h('h2', { class: 'sec-title' }, 'التصويت')),
      segmented('طريقة التصويت',
        [{ value: 'secret', label: 'سرّي عالتلفون' }, { value: 'open', label: 'عالسريع بالإيد' }],
        S.settings.vote,
        (v) => { S.settings.vote = v; commit(); drawVoteNote(); }),
      voteNote,
    ),
    h('footer', { class: 'foot foot-sticky' }, note, cta),
  );
}

function segmented(label, options, value, onPick) {
  const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  for (const o of options) {
    group.append(h('button', {
      class: 'seg-btn', type: 'button', role: 'radio', 'aria-checked': String(o.value === value),
      onclick: (e) => {
        group.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-checked', String(b === e.currentTarget)));
        sfx.tap();
        onPick(o.value);
      },
    }, o.label));
  }
  return group;
}

function howTo() {
  const step = (n, title, text) => h('li', { class: 'how' },
    h('span', { class: 'how-n' }, String(n)),
    h('div', null, h('strong', null, title), h('p', null, text)));
  const point = (n, text) => h('li', null, h('span', { class: 'plus' }, `+${n}`), text);
  sheet({
    title: 'كيف نلعب؟',
    body: [
      h('ol', { class: 'hows' },
        step(1, 'كل واحد بيشوف دوره لحاله', 'التلفون بيلف عليكم. الكل بيشوف الكلمة السرّية… إلا الكذّاب، بيعرف الفئة بس.'),
        step(2, 'اسألوا بعض', 'كل واحد بيسأل سؤال عن الكلمة. جاوبوا بذكاء: مش واضح كثير عشان الكذّاب ما يلقطها، ومش غامض كثير عشان ما يشكّوا فيك.'),
        step(3, 'صوّتوا', 'مين الكذّاب؟ إذا أخذ أكثر أصوات لحاله بينكشف. التعادل لصالحه.'),
        step(4, 'الفرصة الأخيرة', 'الكذّاب بيحزر الكلمة من 8 خيارات. إذا حزرها بياخد نقاط حتى لو انكشف.'),
      ),
      h('h3', { class: 'sheet-sub' }, 'النقاط'),
      h('ul', { class: 'points' },
        point(POINTS.vote, 'صوّتت عالكذّاب'),
        point(POINTS.escape, 'كنت الكذّاب وفلتت من التصويت'),
        point(POINTS.guess, 'كنت الكذّاب وحزرت الكلمة'),
      ),
    ],
  });
}

// ——————————————————— كشف الأدوار ———————————————————

function Pass({ p, note, i, n, onGo, onBack }) {
  return h('section', { class: 'screen pass' },
    roundBar(),
    h('div', { class: 'center' },
      h('div', { class: 'halo' }, avatar(p, 'xl')),
      h('h1', { class: 'display big-name', tabindex: '-1', 'data-focus': '' }, p.name),
      h('p', { class: 'muted' }, note),
    ),
    h('footer', { class: 'foot' },
      n ? dots(i, n) : null,
      h('button', { class: 'btn btn-lg', type: 'button', onclick: onGo }, `أنا ${p.name}`),
      onBack && h('button', { class: 'btn btn-text', type: 'button', onclick: onBack }, 'رجوع'),
    ),
  );
}

function PassReveal() {
  const r = S.round;
  return Pass({
    p: byId(r.order[r.idx]),
    note: 'مرّروا التلفون، والشاشة سر.',
    i: r.idx,
    n: r.order.length,
    onGo: () => { ui.ready = true; sfx.tap(); render(); },
  });
}

function PassAgain() {
  return Pass({
    p: byId(ui.repeek.id),
    note: 'مرّروا التلفون لنظرة ثانية عالكلمة.',
    onGo: () => { ui.repeek.open = true; sfx.tap(); render(); },
    onBack: () => { ui.repeek = null; render(); },
  });
}

// الكرت بينكشف بس والإصبع عليه — أول ما ينرفع بيتخبّى.
// شكل كرت الكذّاب نفس شكل كرت الباقي بالزبط، عشان اللي حواليك ما يفرّقوا من بعيد.
function Peek(p, again) {
  const r = S.round;
  const cat = catById(r.catId);
  const isLiar = p.id === r.liar;
  const last = r.idx === r.order.length - 1;
  let downAt = 0;

  const secret = h('div', { class: 'peek-secret' });
  const card = h('button', { class: 'peek', type: 'button', 'aria-label': 'اضغط مطوّلاً لتشوف دورك' },
    h('div', { class: 'peek-cover' },
      h('p', { class: 'peek-plaque' }, icon('touch', 22), 'اضغط مطوّل لتشوف'),
    ),
    secret,
  );
  const hint = h('p', { class: 'muted center-text', role: 'status' }, 'الكلمة بتبيّن وإصبعك عالكرت، وبتتخبّى أول ما ترفعه.');
  const done = h('button', { class: 'btn btn-lg', type: 'button', disabled: true, onclick: finish },
    again ? 'رجّعوني للنقاش' : last ? 'الكل شاف — يلا نبدأ' : 'شفتها — مرّروا التلفون');

  function show() {
    if (card.classList.contains('on')) return;
    const size = [...r.word].length <= 5 ? 'xl' : [...r.word].length <= 9 ? 'lg' : [...r.word].length <= 14 ? 'md' : 'sm';
    secret.replaceChildren(
      h('p', { class: `display secret-word ${isLiar ? 'lg' : size}` }, isLiar ? 'أنت الكذّاب' : r.word),
      h('p', { class: 'secret-meta' }, isLiar ? 'الكلمة مخفية عنك.' : 'هاي الكلمة السرّية.', cat && ` الفئة: ${cat.name}.`),
      h('p', { class: 'secret-tip' }, isLiar
        ? 'مثّل إنك عارف، والقط الكلمة من كلامهم.'
        : 'لمّح بدون ما تفضح الكلمة.'),
    );
    card.classList.add('on');
    downAt = performance.now();
    sfx.peek();
    buzz(12);
  }
  function hide() {
    if (!card.classList.contains('on')) return;
    card.classList.remove('on');
    secret.replaceChildren();
    if (performance.now() - downAt > 220) {
      done.disabled = false;
      hint.textContent = 'بدّك تتأكد؟ اضغط كمان مرة.';
    }
  }
  function finish() {
    hide();
    if (again) {
      ui.repeek = null;
    } else {
      ui.ready = false;
      r.idx++;
      if (r.idx >= r.order.length) {
        r.phase = 'talk';
        r.idx = 0;
        const total = S.settings.timer;
        r.timer = total ? { total, endsAt: Date.now() + total * 1000, left: null, done: false } : null;
      }
      commit();
    }
    sfx.next();
    render();
  }

  card.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { card.setPointerCapture(e.pointerId); } catch { /* مش ضروري */ }
    show();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) card.addEventListener(type, hide);
  card.addEventListener('contextmenu', (e) => e.preventDefault());
  card.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); show(); }
  });
  card.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') hide();
  });
  card.addEventListener('blur', hide);
  const onHidden = () => { if (document.visibilityState !== 'visible') hide(); };
  document.addEventListener('visibilitychange', onHidden);
  onLeave(() => document.removeEventListener('visibilitychange', onHidden));

  return h('section', { class: 'screen' },
    roundBar(),
    h('h1', { class: 'display title center-text', tabindex: '-1', 'data-focus': '' }, `دورك يا ${p.name}`),
    card,
    hint,
    h('footer', { class: 'foot' }, !again && dots(r.idx, r.order.length), done),
  );
}

// ——————————————————— النقاش ———————————————————

function Talk() {
  const r = S.round;
  const t = r.timer;
  let lastTick = -1;

  const cta = h('button', { class: 'btn btn-lg', type: 'button', onclick: toVote }, icon('vote', 24), 'عالتصويت');

  // المؤقت
  let timerEl = null;
  if (t) {
    const time = h('span', { class: 'timer-time', dir: 'ltr' });
    const state = h('span', { class: 'timer-state' });
    timerEl = h('button', { class: 'timer', type: 'button', onclick: togglePause }, time, h('span', { class: 'timer-bar', 'aria-hidden': 'true' }, h('span')), state);
    const left = () => (t.left != null ? t.left : Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000)));
    const paint = () => {
      const s = left();
      const paused = t.left != null && s > 0;
      time.textContent = mmss(s);
      timerEl.style.setProperty('--p', String((s / t.total) * 100));
      timerEl.classList.toggle('low', s > 0 && s <= 10);
      timerEl.classList.toggle('over', s === 0);
      timerEl.classList.toggle('paused', paused);
      state.textContent = s === 0 ? 'خلص الوقت' : paused ? 'متوقف — اضغط للتكملة' : 'اضغط للإيقاف';
      timerEl.setAttribute('aria-label', `باقي ${mmss(s)} — ${state.textContent}`);
      if (s === 0 && !t.done) {
        t.done = true;
        commit();
        sfx.timeup();
        buzz([180, 90, 180]);
        toast('خلص الوقت! يلا عالتصويت');
      } else if (!paused && s > 0 && s <= 5 && s !== lastTick) {
        lastTick = s;
        sfx.tick();
      }
      cta.classList.toggle('pulse', s === 0);
    };
    function togglePause() {
      const s = left();
      if (s === 0) return;
      if (t.left != null) {
        t.endsAt = Date.now() + t.left * 1000;
        t.left = null;
      } else {
        t.left = s;
      }
      commit();
      sfx.tap();
      paint();
    }
    paint();
    const iv = setInterval(paint, 250);
    onLeave(() => clearInterval(iv));
  }

  // مين يسأل مين
  const pairBox = h('div', { class: 'card pair' });
  const who = (p) => h('div', { class: 'who' }, avatar(p, 'lg'), h('span', { class: 'who-name' }, p.name));
  function drawPair() {
    if (r.pairIdx < r.pairs.length) {
      const [a, b] = r.pairs[r.pairIdx].map(byId);
      const isLast = r.pairIdx === r.pairs.length - 1;
      pairBox.replaceChildren(
        h('div', { class: 'pair-row' }, who(a), h('span', { class: 'pair-arrow' }, 'يسأل', icon('next', 22)), who(b)),
        h('p', { class: 'muted small' }, `سؤال ${r.pairIdx + 1} من ${r.pairs.length} — سؤال واحد عن الكلمة، بدون ما تنفضح.`),
        h('button', {
          class: 'btn btn-quiet', type: 'button', onclick: () => { r.pairIdx++; commit(); sfx.tap(); drawPair(); },
        }, isLast ? 'خلصت الأسئلة' : 'السؤال اللي بعده'),
      );
    } else {
      pairBox.replaceChildren(
        h('p', { class: 'display open-talk' }, 'اسألوا مين ما بدكم… وشكّوا بالكل'),
        h('p', { class: 'muted small' }, 'لما تحسّوا إنكم عرفتوه، روحوا عالتصويت.'),
      );
    }
    pairBox.classList.remove('pop');
    void pairBox.offsetWidth;
    pairBox.classList.add('pop');
  }
  drawPair();

  // أفكار أسئلة
  let ideas = shuffle(QUESTION_IDEAS);
  const ideaText = h('p', { class: 'idea-text', role: 'status', hidden: true });
  const ideaBtn = h('button', {
    class: 'idea', type: 'button', onclick: () => {
      if (!ideas.length) ideas = shuffle(QUESTION_IDEAS);
      ideaText.textContent = `«${ideas.pop()}»`;
      ideaText.hidden = false;
      ideaText.classList.remove('pop');
      void ideaText.offsetWidth;
      ideaText.classList.add('pop');
      sfx.tap();
    },
  }, icon('dice', 20), h('span', null, 'أعطيني سؤال'));

  function toVote() {
    r.phase = 'vote';
    r.idx = 0;
    ui.ready = false;
    commit();
    sfx.next();
    render();
  }

  function forgot() {
    const close = sheet({
      title: 'مين نسي الكلمة؟',
      body: h('div', { class: 'people' }, S.players.map((p) => h('button', {
        class: 'person', type: 'button', onclick: () => { close(); ui.repeek = { id: p.id, open: false }; render(); },
      }, avatar(p, 'lg'), h('span', { class: 'person-name' }, p.name)))),
    });
  }

  return h('section', { class: 'screen' },
    roundBar(),
    h('h1', { class: 'display title center-text talk-title', tabindex: '-1', 'data-focus': '' }, 'مين الكذّاب؟'),
    timerEl,
    pairBox,
    h('div', { class: 'helpers' },
      ideaBtn,
      h('button', { class: 'idea', type: 'button', onclick: forgot }, icon('eye', 20), h('span', null, 'نسيت الكلمة؟')),
    ),
    ideaText,
    h('footer', { class: 'foot foot-sticky' }, cta),
  );
}

// ——————————————————— التصويت ———————————————————

function PassVote() {
  const r = S.round;
  return Pass({
    p: byId(r.order[r.idx]),
    note: 'مرّروا التلفون للتصويت بالسر.',
    i: r.idx,
    n: r.order.length,
    onGo: () => { ui.ready = true; sfx.tap(); render(); },
  });
}

function peopleGrid(players, onPick, extra) {
  const grid = h('div', { class: 'people' });
  const mark = (btn) => grid.querySelectorAll('.person').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  for (const p of players) {
    grid.append(h('button', {
      class: 'person', type: 'button', 'aria-pressed': 'false',
      onclick: (e) => { mark(e.currentTarget); sfx.tap(); onPick(p.id); },
    }, avatar(p, 'lg'), h('span', { class: 'person-name' }, p.name)));
  }
  if (extra) {
    grid.append(h('button', {
      class: 'person person-wide', type: 'button', 'aria-pressed': 'false',
      onclick: (e) => { mark(e.currentTarget); sfx.tap(); onPick(extra.value); },
    }, h('span', { class: 'person-name' }, extra.label)));
  }
  return grid;
}

function Vote() {
  const r = S.round;
  const voter = byId(r.order[r.idx]);
  let choice = null;
  const cta = h('button', { class: 'btn btn-lg btn-lie', type: 'button', disabled: true, onclick: confirm }, 'ثبّت صوتي');

  function confirm() {
    if (!choice) return;
    r.votes[voter.id] = choice;
    r.idx++;
    ui.ready = false;
    if (r.idx >= r.order.length) {
      r.phase = 'result';
      r.step = 'tally';
    }
    commit();
    sfx.next();
    render();
  }

  return h('section', { class: 'screen' },
    roundBar(),
    h('div', { class: 'head' },
      h('h1', { class: 'display title', tabindex: '-1', 'data-focus': '' }, `يا ${voter.name}، مين الكذّاب؟`),
    ),
    peopleGrid(S.players.filter((p) => p.id !== voter.id), (id) => { choice = id; cta.disabled = false; }),
    h('footer', { class: 'foot foot-sticky' }, dots(r.idx, r.order.length), cta),
  );
}

function OpenVote() {
  const r = S.round;
  let choice;
  const cta = h('button', { class: 'btn btn-lg btn-lie', type: 'button', disabled: true, onclick: confirm }, 'ثبّتوا المتّهم');

  function confirm() {
    if (choice === undefined) return;
    r.accused = choice;
    r.phase = 'result';
    r.step = 'unmask';
    ui.unmasked = false;
    commit();
    sfx.next();
    render();
  }

  return h('section', { class: 'screen' },
    roundBar(),
    h('div', { class: 'head' },
      h('h1', { class: 'display title', tabindex: '-1', 'data-focus': '' }, 'مين أخذ أكثر أصابع؟'),
      h('p', { class: 'muted' }, 'عدّوا 1، 2، 3… وكل واحد يأشّر عالكذّاب.'),
    ),
    peopleGrid(S.players, (id) => { choice = id; cta.disabled = false; }, { value: null, label: 'تعادل — ما اتفقنا' }),
    h('footer', { class: 'foot foot-sticky' }, cta),
  );
}

// ——————————————————— النتيجة ———————————————————

function Tally() {
  const r = S.round;
  const t = tally(r.order, r.votes);
  const rows = S.players
    .map((p, i) => ({ p, i, n: t.counts[p.id] }))
    .sort((a, b) => b.n - a.n || a.i - b.i);

  // لوحة طاولة الزهر: كل لاعب إله خانة، وكل صوت عليه حجر بينحط فيها.
  const list = h('ol', { class: 'board' }, rows.map(({ p, n }) => h('li', { class: `point${n === t.max && n > 0 ? ' top' : ''}` },
    h('span', { class: 'point-who' }, avatar(p, 'md'), h('span', { class: 'clip' }, p.name)),
    h('span', { class: 'point-track' },
      h('span', { class: 'point-tri', 'aria-hidden': 'true' }),
      h('span', { class: 'point-stack' }, t.voters[p.id].map((id, j) => h('span', { class: 'point-chk', style: { '--i': String(j) } }, avatar(byId(id), 'xs')))),
    ),
    h('span', { class: 'point-n' }, String(n)),
  )));
  requestAnimationFrame(() => requestAnimationFrame(() => list.classList.add('grow')));

  return h('section', { class: 'screen' },
    roundBar(),
    h('div', { class: 'head' },
      h('h1', { class: 'display title', tabindex: '-1', 'data-focus': '' }, 'مين اتّهمتوا؟'),
    ),
    list,
    h('footer', { class: 'foot foot-sticky' },
      h('button', {
        class: 'btn btn-lg', type: 'button',
        onclick: () => { r.step = 'unmask'; ui.unmasked = false; commit(); render(); },
      }, 'اكشفوا الكذّاب'),
    ),
  );
}

function Unmask() {
  const r = S.round;
  const liar = byId(r.liar);
  const caught = isCaught(r, r.order);

  let why;
  if (r.voteMode === 'open') {
    why = caught ? 'اتّهمتوا الشخص الصح.'
      : r.accused ? `اتّهمتوا ${nameOf(r.accused)}… غلط!` : 'ما اتفقتوا على حدا.';
  } else {
    const t = tally(r.order, r.votes);
    if (caught) why = `${votesWord(t.max)} — أكثر واحد. كشفتوه!`;
    else if (t.top.includes(r.liar)) why = 'تعادل بالأصوات… والتعادل لصالح الكذّاب.';
    else why = `أكثر الأصوات راحت لـ ${t.top.map(nameOf).join(' و')}… غلط!`;
  }

  const slot = h('div', { class: 'slot' });
  const face = (p) => [h('div', { class: 'halo' }, avatar(p, 'xl')), h('p', { class: 'display big-name' }, p.name)];
  const verdict = h('div', { class: `verdict ${caught ? 'good' : 'bad'}`, hidden: true },
    h('p', { class: 'display verdict-title' }, caught ? 'انكشف!' : 'فلت منكم!'),
    h('p', null, why),
  );
  const cta = h('button', {
    class: 'btn btn-lg', type: 'button', hidden: true,
    onclick: () => { r.step = 'guess'; commit(); sfx.next(); render(); },
  }, 'الفرصة الأخيرة: يحزر الكلمة');

  function land(quiet) {
    slot.replaceChildren(...face(liar));
    slot.classList.add('landed');
    verdict.hidden = false;
    cta.hidden = false;
    if (quiet) return;
    ui.unmasked = true;
    buzz(caught ? [60, 40, 120] : 200);
    if (caught) sfx.win(); else sfx.lose();
  }

  if (ui.unmasked) {
    land(true);
  } else if (calm) {
    land(false);
  } else {
    const names = shuffle(S.players);
    let i = 0;
    const spin = () => { slot.replaceChildren(...face(names[i++ % names.length])); sfx.drum(); };
    spin();
    const iv = setInterval(spin, 120);
    const to = setTimeout(() => { clearInterval(iv); land(false); }, 2000);
    onLeave(() => { clearInterval(iv); clearTimeout(to); });
  }

  return h('section', { class: 'screen' },
    roundBar(),
    h('div', { class: 'center' },
      h('h1', { class: 'lead-in', tabindex: '-1', 'data-focus': '' }, 'الكذّاب هو…'),
      slot,
      verdict,
    ),
    h('footer', { class: 'foot' }, cta),
  );
}

function finalize() {
  const r = S.round;
  if (r.result) return;
  r.result = scoreRound(r, r.order);
  for (const [id, pt] of Object.entries(r.result.points)) S.scores[id] = (S.scores[id] || 0) + pt.total;
  S.liarTimes[r.liar] = (S.liarTimes[r.liar] || 0) + 1;
  S.rounds++;
}

function Guess() {
  const r = S.round;
  const liar = byId(r.liar);
  const cat = catById(r.catId);
  const answered = r.guess != null;
  const right = r.guess === r.word;

  const grid = h('div', { class: 'options' }, r.options.map((w) => h('button', {
    class: `option${answered && w === r.word ? ' right' : ''}${answered && w === r.guess && !right ? ' wrong' : ''}`,
    type: 'button',
    disabled: answered,
    onclick: () => {
      r.guess = w;
      finalize();
      commit();
      if (w === r.word) { sfx.win(); buzz([60, 40, 120]); } else { sfx.lose(); buzz(200); }
      render();
    },
  }, w)));

  return h('section', { class: 'screen' },
    roundBar(),
    h('div', { class: 'head' },
      h('h1', { class: 'display title', tabindex: '-1', 'data-focus': '' }, answered ? r.word : `شو كانت الكلمة يا ${liar.name}؟`),
      h('p', { class: 'muted' }, answered ? 'هاي كانت الكلمة.' : `${cat ? `الفئة: ${cat.name}. ` : ''}الباقي: ولا تلميح!`),
    ),
    grid,
    answered && h('div', { class: `verdict ${right ? 'bad' : 'good'}` },
      h('p', { class: 'display verdict-title' }, right ? 'حزرها!' : 'ما حزرها!'),
      h('p', null, right ? `الكلمة انلقطت من كلامكم — نقطتين لـ ${liar.name}.` : `جواب ${liar.name} كان «${r.guess}».`),
    ),
    h('footer', { class: 'foot foot-sticky' },
      answered && h('button', {
        class: 'btn btn-lg', type: 'button',
        onclick: () => { r.step = 'summary'; commit(); sfx.next(); render(); },
      }, 'شوفوا النقاط'),
    ),
  );
}

const WHY = { vote: 'تصويت صح', escape: 'نجاة من التصويت', guess: 'تخمين الكلمة' };

function Summary() {
  const r = S.round;
  const cat = catById(r.catId);
  const pts = r.result.points;
  const rows = S.players
    .map((p, i) => ({ p, i, got: pts[p.id]?.total ?? 0, why: pts[p.id]?.why ?? [] }))
    .sort((a, b) => b.got - a.got || a.i - b.i);

  return h('section', { class: 'screen' },
    roundBar(),
    h('div', { class: 'card word-card' },
      h('p', { class: 'display word-big' }, r.word),
      h('p', { class: 'muted small' }, `${cat ? `${cat.name} · ` : ''}الكذّاب: ${nameOf(r.liar)} — ${r.result.caught ? 'انكشف' : 'فلت'}${r.result.guessed ? ' وحزر الكلمة' : ''}`),
    ),
    h('h1', { class: 'sec-title', tabindex: '-1', 'data-focus': '' }, 'نقاط الجولة'),
    h('ul', { class: 'rows' }, rows.map(({ p, got, why }) => h('li', { class: 'row' },
      avatar(p, 'md'),
      h('div', { class: 'row-main' },
        h('span', { class: 'row-name' }, h('span', { class: 'clip' }, p.name), p.id === r.liar && h('span', { class: 'tag' }, 'الكذّاب')),
        h('span', { class: 'row-sub' }, why.length ? why.map((k) => WHY[k]).join(' + ') : 'ولا نقطة'),
      ),
      h('span', { class: `gain${got ? '' : ' zero'}` }, `+${got}`),
      h('span', { class: 'total display' }, String(S.scores[p.id] || 0)),
    ))),
    h('footer', { class: 'foot foot-sticky' },
      h('button', { class: 'btn btn-lg', type: 'button', onclick: startRound }, icon('again', 24), 'جولة جديدة'),
      h('div', { class: 'foot-row' },
        h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => leaveRound('board') }, icon('trophy', 20), 'النتائج'),
        h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => leaveRound('home') }, icon('home', 20), 'الرئيسية'),
      ),
    ),
  );
}

// ——————————————————— لوحة النتائج ———————————————————

function ranked() {
  const rows = S.players
    .map((p, i) => ({ p, i, score: S.scores[p.id] || 0 }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  // المتعادلين بياخدوا نفس المركز.
  const levels = [...new Set(rows.map((row) => row.score))];
  return rows.map((row) => ({ ...row, rank: levels.indexOf(row.score) + 1 }));
}
const badge = ({ rank, score }) => (score > 0 && MEDALS[rank - 1]) || String(rank);

async function shareBoard() {
  const lines = ranked().map((row) => `${badge(row)} ${row.p.name} — ${row.score}`);
  const text = [`🤥 الكذّاب — النتيجة بعد ${roundsWord(S.rounds)}`, ...lines, '', `العبوها: ${location.origin}`].join('\n');
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('انتسخت النتيجة');
  } catch {
    toast('ما زبط النسخ — صوّروا الشاشة');
  }
}

function Board() {
  const rows = ranked();
  const canPlay = S.players.length >= MIN_PLAYERS && playableCats().length > 0;

  async function reset() {
    const ok = await confirmSheet({
      title: 'نصفّر النقاط؟',
      text: 'كل النقاط وعدد الجولات بيرجعوا صفر. اللاعبين بيضلّوا.',
      yes: 'صفّرها',
      danger: true,
    });
    if (!ok) return;
    S.scores = {};
    S.liarTimes = {};
    S.rounds = 0;
    commit();
    render();
  }

  return h('section', { class: 'screen' },
    h('header', { class: 'bar' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'رجوع للرئيسية', onclick: () => { ui.view = 'home'; render(); } }, icon('home', 22)),
      h('span', { class: 'bar-space' }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'شاركوا النتيجة', onclick: shareBoard }, icon('share', 22)),
    ),
    h('div', { class: 'head' },
      h('h1', { class: 'display title', tabindex: '-1', 'data-focus': '' }, 'لوحة النتائج'),
      h('p', { class: 'muted' }, S.rounds ? `بعد ${roundsWord(S.rounds)}` : 'لسا ما لعبتوا ولا جولة'),
    ),
    h('ul', { class: 'rows' }, rows.map(({ p, score, rank }) => h('li', { class: `row${rank === 1 && score > 0 ? ' lead' : ''}` },
      h('span', { class: 'rank' }, String(rank)),
      avatar(p, 'md'),
      h('div', { class: 'row-main' },
        h('span', { class: 'row-name' }, h('span', { class: 'clip' }, p.name)),
        h('span', { class: 'row-sub' }, S.liarTimes[p.id] ? `الكذّاب ${timesWord(S.liarTimes[p.id])}` : 'ولا مرة الكذّاب'),
      ),
      h('span', { class: 'total display' }, String(score)),
    ))),
    h('footer', { class: 'foot foot-sticky' },
      h('button', { class: 'btn btn-lg', type: 'button', disabled: !canPlay, onclick: startRound }, icon('again', 24), 'جولة جديدة'),
      S.rounds > 0 && h('button', { class: 'btn btn-text', type: 'button', onclick: reset }, icon('trash', 18), 'صفّروا النقاط'),
    ),
  );
}

// ——————————————————— تشغيل ———————————————————

if (S.round) armBack();
render();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadWorker = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // نسخة جديدة نزلت: حدّث فوراً إذا ما في جولة شغّالة.
    if (!hadWorker || reloaded || S.round) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => { /* اللعبة بتشتغل بدونه */ });
}
