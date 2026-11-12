// أصوات صغيرة مصنوعة بالـ WebAudio (بدون ملفات) + اهتزاز.

let ctx = null;
let on = true;

export function setSound(value) {
  on = !!value;
}

// المتصفح بيمنع الصوت والاهتزاز قبل أول لمسة — فما بنحاول قبلها.
const touched = () => navigator.userActivation?.hasBeenActive ?? true;

function audio() {
  if (!on || !touched()) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// notes: [تردد, بداية بالثواني, مدة, نوع الموجة, علوّ]
function play(notes) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.01;
  for (const [freq, at, dur, type = 'triangle', vol = 0.09] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0 + at);
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.03);
  }
}

export const sfx = {
  tap: () => play([[620, 0, 0.06]]),
  add: () => play([[520, 0, 0.07], [780, 0.06, 0.09]]),
  remove: () => play([[420, 0, 0.08], [300, 0.06, 0.1]]),
  peek: () => play([[330, 0, 0.1, 'sine'], [495, 0.07, 0.14, 'sine']]),
  next: () => play([[494, 0, 0.07], [659, 0.07, 0.1]]),
  tick: () => play([[880, 0, 0.05, 'square', 0.04]]),
  timeup: () => play([[660, 0, 0.16, 'square', 0.06], [660, 0.22, 0.16, 'square', 0.06], [440, 0.44, 0.4, 'square', 0.06]]),
  drum: () => play([[110, 0, 0.09, 'sawtooth', 0.05]]),
  reveal: () => play([[392, 0, 0.12], [523, 0.1, 0.12], [659, 0.2, 0.12], [784, 0.3, 0.3]]),
  win: () => play([[523, 0, 0.12], [659, 0.11, 0.12], [784, 0.22, 0.12], [1047, 0.33, 0.36]]),
  lose: () => play([[392, 0, 0.16, 'sawtooth', 0.05], [330, 0.15, 0.16, 'sawtooth', 0.05], [262, 0.3, 0.4, 'sawtooth', 0.05]]),
};

export function buzz(pattern) {
  if (!on || !touched()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* مش مدعوم */
  }
}
