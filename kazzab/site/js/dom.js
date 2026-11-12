// أدوات الواجهة: بناء العناصر، الأيقونات، التنبيه الصغير، والنوافذ السفلية.
// أسماء اللاعبين وكلماتهم بتنحط دايماً كنص (مش HTML) — ما في حقن.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') {
        for (const [p, val] of Object.entries(v)) {
          if (p.startsWith('--')) el.style.setProperty(p, val);
          else el.style[p] = val;
        }
      } else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, kids);
  return el;
}

function add(el, kids) {
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    if (Array.isArray(kid)) add(el, kid);
    else el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
}

// نص ثابت من الكود نفسه فقط — ممنوع يمرّ عليه أي إدخال من المستخدم.
function fromMarkup(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.3a2.7 2.7 0 1 1 4.2 2.3c-.9.6-1.6 1.2-1.6 2.3M12 17.2v.1"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>',
  mute: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5c0 2.2 1.2 3.6 3.2 3.9M16 6h3c0 2.2-1.2 3.6-3.2 3.9M12 13v4M8.5 20h7M10 17h4"/>',
  share: '<path d="M12 15V3.5M8 7.5l4-4 4 4M5 12.5V20h14v-7.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  next: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  play: '<path d="M8 5.5l10.5 6.5L8 18.5v-13z"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5.5v-5.5h-5V20H4v-9z"/>',
  again: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.6h-4.6"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7"/>',
  touch: '<circle cx="12" cy="12" r="2.6"/><path d="M6.2 15.5a6.8 6.8 0 1 1 11.6 0M3.4 18a10.4 10.4 0 1 1 17.2 0"/>',
  vote: '<path d="M4 13.5V20h16v-6.5M7.5 13.5h9M9 4.5h6l1.5 9h-9l1.5-9z"/>',
};

export function icon(name, size = 24) {
  return fromMarkup(
    `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
      `stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`,
  );
}

// شخصية اللعبة: وجه متوتر ومناخيره طويلة.
const MASCOT =
  '<svg class="mascot" viewBox="0 0 128 128" aria-hidden="true">' +
  '<circle cx="50" cy="66" r="40" fill="#ffd447" stroke="#17112b" stroke-width="5"/>' +
  '<path d="M26 31l15-5M52 27l15 4" stroke="#17112b" stroke-width="5" stroke-linecap="round" fill="none"/>' +
  '<ellipse cx="35" cy="47" rx="8" ry="9.5" fill="#fff" stroke="#17112b" stroke-width="4"/>' +
  '<ellipse cx="60" cy="47" rx="8" ry="9.5" fill="#fff" stroke="#17112b" stroke-width="4"/>' +
  '<circle cx="38.5" cy="49" r="4" fill="#17112b"/><circle cx="63.5" cy="49" r="4" fill="#17112b"/>' +
  '<rect x="54" y="61" width="68" height="17" rx="8.5" fill="#ff5d73" stroke="#17112b" stroke-width="5"/>' +
  '<path d="M28 91q5.5-6 11 0t11 0 11 0" stroke="#17112b" stroke-width="4.5" stroke-linecap="round" fill="none"/>' +
  '<path d="M11 27c-6 9-6 15 0 15s6-6 0-15z" fill="#6cc5ff" stroke="#17112b" stroke-width="3.5" stroke-linejoin="round"/>' +
  '</svg>';

export function mascot() {
  return fromMarkup(MASCOT);
}

// ——— تنبيه صغير ———
let toastTimer = 0;
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ——— نافذة سفلية ———
const open = [];

export function hasSheet() {
  return open.length > 0;
}

export function closeSheet() {
  const top = open[open.length - 1];
  if (top) top();
}

export function openSheet({ title, body, actions, onClose }) {
  const lastFocus = document.activeElement;
  const panel = h(
    'div',
    { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
    h('div', { class: 'sheet-head' },
      h('h2', { class: 'sheet-title' }, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'إغلاق', onclick: () => close() }, icon('x', 22)),
    ),
    h('div', { class: 'sheet-body' }, body),
    actions ? h('div', { class: 'sheet-actions' }, actions) : null,
  );
  const backdrop = h('div', { class: 'backdrop' }, panel);
  let closed = false;

  function close(result) {
    if (closed) return;
    closed = true;
    open.splice(open.indexOf(close), 1);
    document.removeEventListener('keydown', onKey);
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 220);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    onClose?.(result);
  }
  function onKey(e) {
    if (e.key === 'Escape' && open[open.length - 1] === close) close();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  open.push(close);
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    panel.focus({ preventScroll: true });
  });
  return close;
}

export function confirmSheet({ title, text, yes, no = 'لا، خلّينا', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const close = openSheet({
      title,
      body: h('p', { class: 'sheet-text' }, text),
      actions: [
        h('button', {
          class: `btn ${danger ? 'btn-lie' : ''}`,
          type: 'button',
          onclick: () => {
            answer = true;
            close();
          },
        }, yes),
        h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => close() }, no),
      ],
      onClose: () => resolve(answer),
    });
  });
}
