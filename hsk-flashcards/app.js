/* HSK Flashcards — spaced-repetition study app (vanilla JS, offline-first).
 *
 * Scheduling: an SM-2 variant with short in-session learning steps, so a card
 * is drilled until you know it now, then spaced out over increasing days.
 */
'use strict';

// ---------------------------------------------------------------- constants
const STORE_KEY = 'hsk-srs-v1';
const DAY = 86400000;          // ms in a day
const MIN = 60000;             // ms in a minute
const LEARNING_STEPS = [1 * MIN, 10 * MIN]; // graduating steps for new/lapsed cards
const GRAD_INTERVAL = 1 * DAY; // first interval after graduating with "Good"
const EASY_INTERVAL = 4 * DAY; // first interval after graduating with "Easy"
const MIN_EASE = 1.3;
const START_EASE = 2.5;
const SESSION_REQUEUE_MS = 12 * MIN; // anything due sooner than this stays in this session
const LEVEL_COLORS = {
  1: '#2eaf5a', 2: '#1f8fd6', 3: '#7b5cd6', 4: '#d6a01f', 5: '#e2671f', 6: '#b81d1d',
};
const NEW_LIMIT_OPTIONS = [5, 10, 15, 20, 30, 50];
const DIRECTIONS = [
  { id: 'zh2en', label: 'Hanzi → Meaning' },
  { id: 'en2zh', label: 'Meaning → Hanzi' },
  { id: 'mixed', label: 'Mixed' },
];

// ---------------------------------------------------------------- state
let DATA = {};        // level -> array of card defs {id, hanzi, pinyin, english, level}
let CARD_BY_ID = {};  // id -> card def
let store = null;     // persisted store object
let session = null;   // active study session
let now = Date.now();

// ---------------------------------------------------------------- storage
function defaultStore() {
  return {
    version: 1,
    cards: {},                       // id -> {status, ease, interval, due, reps, lapses, step}
    settings: {
      levels: [1],                   // levels selected for study
      newPerDay: 10,
      direction: 'zh2en',
      pinyinFront: false,
      autoSpeak: false,
    },
    daily: { date: todayStr(), newDone: 0, reviews: 0 },
    streak: { count: 0, lastDay: null },
  };
}
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    store = raw ? JSON.parse(raw) : defaultStore();
  } catch (e) { store = defaultStore(); }
  // backfill any missing keys after upgrades
  const d = defaultStore();
  store.settings = Object.assign({}, d.settings, store.settings || {});
  store.daily = store.daily || d.daily;
  store.streak = store.streak || d.streak;
  store.cards = store.cards || {};
  rolloverDay();
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
  catch (e) { toast('Could not save — storage full?'); }
}
function todayStr(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function rolloverDay() {
  const today = todayStr();
  if (store.daily.date !== today) {
    store.daily = { date: today, newDone: 0, reviews: 0 };
  }
}

// ---------------------------------------------------------------- data loading
async function loadLevel(level) {
  if (DATA[level]) return DATA[level];
  const res = await fetch(`data/hsk${level}.json`, { cache: 'force-cache' });
  const cards = await res.json();
  DATA[level] = cards;
  for (const c of cards) CARD_BY_ID[c.id] = c;
  return cards;
}
async function ensureLevelsLoaded(levels) {
  await Promise.all(levels.map(loadLevel));
}

// ---------------------------------------------------------------- SRS core
function cardState(id) {
  return store.cards[id] || null;
}
function isNew(id) { return !store.cards[id]; }

// Returns preview intervals (ms) for each grade, given the current state.
function previewIntervals(st) {
  if (!st || st.status === 'new' || st.status === 'learning') {
    const step = st ? (st.step || 0) : 0;
    return {
      again: LEARNING_STEPS[0],
      hard: LEARNING_STEPS[Math.min(step, LEARNING_STEPS.length - 1)],
      good: step + 1 < LEARNING_STEPS.length ? LEARNING_STEPS[step + 1] : GRAD_INTERVAL,
      easy: EASY_INTERVAL,
    };
  }
  // review card
  const ease = st.ease || START_EASE;
  const ivl = st.interval || GRAD_INTERVAL;
  return {
    again: LEARNING_STEPS[1],
    hard: Math.max(ivl * 1.2, ivl + DAY),
    good: Math.max(ivl * ease, ivl + DAY),
    easy: Math.max(ivl * ease * 1.3, ivl + 2 * DAY),
  };
}

// Apply a grade. Returns the new state and whether it should stay in this session.
function applyGrade(id, grade) {
  let st = store.cards[id];
  const wasNew = !st;
  if (!st) {
    st = { status: 'learning', ease: START_EASE, interval: 0, due: now, reps: 0, lapses: 0, step: 0 };
    store.cards[id] = st;
  }

  if (st.status === 'new' || st.status === 'learning') {
    if (grade === 'again') {
      st.step = 0;
      st.due = now + LEARNING_STEPS[0];
    } else if (grade === 'hard') {
      st.due = now + LEARNING_STEPS[Math.min(st.step, LEARNING_STEPS.length - 1)];
    } else if (grade === 'good') {
      if (st.step + 1 < LEARNING_STEPS.length) {
        st.step += 1;
        st.due = now + LEARNING_STEPS[st.step];
      } else {
        st.status = 'review'; st.interval = GRAD_INTERVAL; st.due = now + GRAD_INTERVAL; st.reps += 1;
      }
    } else if (grade === 'easy') {
      st.status = 'review'; st.interval = EASY_INTERVAL; st.due = now + EASY_INTERVAL; st.reps += 1;
    }
  } else { // review
    if (grade === 'again') {
      st.lapses += 1; st.status = 'learning'; st.step = 0;
      st.ease = Math.max(MIN_EASE, st.ease - 0.2);
      st.interval = 0; st.due = now + LEARNING_STEPS[1];
    } else {
      let factor;
      if (grade === 'hard') { st.ease = Math.max(MIN_EASE, st.ease - 0.15); factor = 1.2; }
      else if (grade === 'good') { factor = st.ease; }
      else { st.ease += 0.15; factor = st.ease * 1.3; } // easy
      let ivl = Math.max(st.interval * factor, st.interval + DAY);
      ivl = Math.round(ivl);
      st.interval = ivl; st.due = now + ivl; st.reps += 1;
    }
  }

  // daily counters
  if (wasNew) store.daily.newDone += 1;
  else store.daily.reviews += 1;
  bumpStreak();
  saveStore();

  const stayInSession = (st.due - now) <= SESSION_REQUEUE_MS;
  return { state: st, stayInSession };
}

function bumpStreak() {
  const today = todayStr();
  if (store.streak.lastDay === today) return;
  const yesterday = todayStr(now - DAY);
  store.streak.count = store.streak.lastDay === yesterday ? store.streak.count + 1 : 1;
  store.streak.lastDay = today;
}

// ---------------------------------------------------------------- counts
function countsForLevels(levels) {
  now = Date.now();
  let due = 0, learning = 0, known = 0, total = 0, newAvail = 0;
  for (const lvl of levels) {
    const cards = DATA[lvl];
    if (!cards) continue;
    for (const c of cards) {
      total++;
      const st = store.cards[c.id];
      if (!st) { newAvail++; continue; }
      if (st.status === 'review') {
        known++;
        if (st.due <= now) due++;
      } else { // learning
        learning++;
        if (st.due <= now) due++;
      }
    }
  }
  const newAllowance = Math.max(0, store.settings.newPerDay - store.daily.newDone);
  const newToStudy = Math.min(newAvail, newAllowance);
  return { dueReviews: due, learning, known, total, newAvail, newToStudy };
}

// ---------------------------------------------------------------- session
function buildSession(levels) {
  now = Date.now();
  const reviewQueue = []; // {id, due}
  let newPool = [];
  for (const lvl of levels) {
    for (const c of DATA[lvl] || []) {
      const st = store.cards[c.id];
      if (!st) { newPool.push(c.id); continue; }
      if (st.due <= now) reviewQueue.push({ id: c.id, due: st.due });
    }
  }
  reviewQueue.sort((a, b) => a.due - b.due);

  const allowance = Math.max(0, store.settings.newPerDay - store.daily.newDone);
  newPool = newPool.slice(0, allowance);

  // Interleave new cards among reviews so a session isn't front-loaded.
  const queue = reviewQueue.map((x) => x.id);
  if (newPool.length) {
    const spacing = Math.max(1, Math.floor((queue.length + newPool.length) / newPool.length));
    let qi = 0;
    for (const nid of newPool) {
      const pos = Math.min(queue.length, qi + spacing);
      queue.splice(pos, 0, nid);
      qi = pos + 1;
    }
  }

  session = {
    queue,
    totalPlanned: queue.length,
    done: 0,
    correct: 0,
    reviewed: 0,
    levels,
    current: null,
    revealed: false,
  };
  return session;
}

function nextCard() {
  if (!session.queue.length) return null;
  session.current = session.queue.shift();
  session.revealed = false;
  return session.current;
}

// ---------------------------------------------------------------- views
const views = {};
['home', 'study', 'done', 'settings'].forEach((v) => { views[v] = document.getElementById('view-' + v); });
function show(view) {
  Object.values(views).forEach((el) => el.classList.remove('active'));
  views[view].classList.add('active');
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- home render
async function renderHome() {
  now = Date.now();
  rolloverDay();
  const levels = store.settings.levels;
  await ensureLevelsLoaded(levels);
  const c = countsForLevels(levels);
  const totalDue = c.dueReviews + c.newToStudy;

  document.getElementById('due-count').textContent = totalDue;
  const ring = document.querySelector('.due-ring');
  const planned = Math.max(totalDue, 1);
  ring.style.setProperty('--ring', `${Math.min(360, (c.dueReviews / planned) * 360)}deg`);

  document.getElementById('stat-new').textContent = store.daily.newDone;
  document.getElementById('stat-learning').textContent = c.learning;
  document.getElementById('stat-known').textContent = c.known;
  document.getElementById('stat-streak').textContent = store.streak.count;

  const start = document.getElementById('start-review');
  const sub = document.getElementById('hero-sub');
  if (totalDue > 0) {
    start.disabled = false; start.textContent = 'Start studying';
    sub.textContent = `${c.dueReviews} review${c.dueReviews === 1 ? '' : 's'} · ${c.newToStudy} new`;
  } else if (c.newAvail > 0) {
    start.disabled = false; start.textContent = 'Study ahead';
    sub.textContent = `All caught up! ${c.newAvail} new cards remain in these levels.`;
  } else {
    start.disabled = false; start.textContent = 'Review anyway';
    sub.textContent = 'Nothing due right now — nice work.';
  }

  renderLevelList();
}

function renderLevelList() {
  const wrap = document.getElementById('level-list');
  wrap.innerHTML = '';
  const meta = { 1: 150, 2: 150, 3: 300, 4: 600, 5: 1300, 6: 2500 };
  for (let lvl = 1; lvl <= 6; lvl++) {
    const total = meta[lvl];
    let learned = 0, started = 0;
    if (DATA[lvl]) {
      for (const card of DATA[lvl]) {
        const st = store.cards[card.id];
        if (st) { started++; if (st.status === 'review') learned++; }
      }
    } else {
      for (const id in store.cards) {
        const cd = CARD_BY_ID[id];
        if (cd && cd.level === lvl) { started++; if (store.cards[id].status === 'review') learned++; }
      }
    }
    const pct = Math.round((learned / total) * 100);
    const selected = store.settings.levels.includes(lvl);
    const row = document.createElement('div');
    row.className = 'level-row';
    row.innerHTML = `
      <div class="level-badge" style="background:${LEVEL_COLORS[lvl]}">HSK${lvl}</div>
      <div class="level-info">
        <div class="level-name">HSK ${lvl} <span style="color:var(--muted);font-weight:500">· ${total} words</span></div>
        <div class="level-meta">${learned} learned · ${started} seen${selected ? ' · studying' : ''}</div>
        <div class="level-bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="level-pct">${pct}%</div>`;
    row.addEventListener('click', () => openSettings());
    wrap.appendChild(row);
  }
}

// ---------------------------------------------------------------- study render
function renderCard() {
  const id = session.current;
  const card = CARD_BY_ID[id];
  const st = cardState(id);

  // queue / progress
  const remaining = session.queue.length + 1;
  document.getElementById('queue-count').textContent = remaining;
  const pct = session.totalPlanned ? (session.done / session.totalPlanned) * 100 : 0;
  document.getElementById('progress-fill').style.width = `${Math.min(100, pct)}%`;

  document.getElementById('card-level').textContent = `HSK ${card.level}` + (isNew(id) ? ' · new' : '');

  // direction
  let dir = store.settings.direction;
  if (dir === 'mixed') dir = (id % 2 === 0) ? 'zh2en' : 'en2zh';

  const promptEl = document.getElementById('card-prompt');
  const pinyinEl = document.getElementById('ans-pinyin');
  const englishEl = document.getElementById('ans-english');

  if (dir === 'zh2en') {
    promptEl.textContent = card.hanzi;
    promptEl.classList.remove('small');
    pinyinEl.textContent = card.pinyin;
    englishEl.textContent = card.english;
    if (store.settings.pinyinFront) { promptEl.innerHTML = `${card.hanzi}<div style="font-size:24px;color:var(--red);margin-top:10px">${card.pinyin}</div>`; }
  } else {
    promptEl.textContent = card.english;
    promptEl.classList.add('small');
    pinyinEl.textContent = card.pinyin;
    englishEl.innerHTML = `<div style="font-size:56px;font-weight:600;margin-bottom:6px">${card.hanzi}</div>`;
  }

  // reset reveal
  session.revealed = false;
  document.getElementById('card-answer').classList.add('hidden');
  document.getElementById('grade-row').classList.add('hidden');
  document.getElementById('reveal-btn').classList.remove('hidden');

  // grade time labels
  const iv = previewIntervals(st);
  document.getElementById('t-again').textContent = fmtInterval(iv.again);
  document.getElementById('t-hard').textContent = fmtInterval(iv.hard);
  document.getElementById('t-good').textContent = fmtInterval(iv.good);
  document.getElementById('t-easy').textContent = fmtInterval(iv.easy);

  if (store.settings.autoSpeak && dir === 'zh2en') speak(card.hanzi);
}

function reveal() {
  if (session.revealed) return;
  session.revealed = true;
  document.getElementById('card-answer').classList.remove('hidden');
  document.getElementById('reveal-btn').classList.add('hidden');
  document.getElementById('grade-row').classList.remove('hidden');
  if (store.settings.autoSpeak) speak(CARD_BY_ID[session.current].hanzi);
}

function grade(g) {
  if (!session.revealed) return;
  const id = session.current;
  const { stayInSession } = applyGrade(id, g);
  session.done += 1;
  if (g !== 'again') session.correct += 1;
  session.reviewed += 1;

  if (stayInSession) {
    // re-insert a few positions back so it cycles within this session
    const pos = Math.min(session.queue.length, g === 'again' ? 2 : 6);
    session.queue.splice(pos, 0, id);
  }
  advance();
}

function advance() {
  const next = nextCard();
  if (next == null) { finishSession(); return; }
  renderCard();
}

function finishSession() {
  const summary = document.getElementById('done-summary');
  const acc = session.reviewed ? Math.round((session.correct / session.reviewed) * 100) : 100;
  summary.innerHTML = `You studied <strong>${session.reviewed}</strong> card${session.reviewed === 1 ? '' : 's'}` +
    ` with <strong>${acc}%</strong> recall.<br>Come back tomorrow to keep them fresh.`;
  show('done');
}

// ---------------------------------------------------------------- helpers
function fmtInterval(ms) {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(days < 90 ? 1 : 0)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

let voices = [];
function loadVoices() { voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    const zh = voices.find((v) => /zh|cmn/i.test(v.lang));
    if (zh) u.voice = zh;
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------- settings UI
function buildSeg(containerId, options, current, onPick) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  options.forEach((opt) => {
    const b = document.createElement('button');
    b.textContent = opt.label;
    if (opt.value === current) b.classList.add('active');
    b.addEventListener('click', () => {
      [...el.children].forEach((c) => c.classList.remove('active'));
      b.classList.add('active');
      onPick(opt.value);
    });
    el.appendChild(b);
  });
}

function renderSettings() {
  // levels
  const lc = document.getElementById('level-checks');
  lc.innerHTML = '';
  for (let lvl = 1; lvl <= 6; lvl++) {
    const row = document.createElement('label');
    row.className = 'check-row';
    const checked = store.settings.levels.includes(lvl) ? 'checked' : '';
    row.innerHTML = `<span>HSK ${lvl}</span><input type="checkbox" data-level="${lvl}" ${checked} />`;
    row.querySelector('input').addEventListener('change', (e) => {
      const l = lvl;
      const set = new Set(store.settings.levels);
      if (e.target.checked) set.add(l); else set.delete(l);
      if (set.size === 0) { set.add(l); e.target.checked = true; toast('Keep at least one level'); }
      store.settings.levels = [...set].sort((a, b) => a - b);
      saveStore();
      ensureLevelsLoaded(store.settings.levels);
    });
    lc.appendChild(row);
  }

  buildSeg('newlimit-seg', NEW_LIMIT_OPTIONS.map((n) => ({ label: String(n), value: n })),
    store.settings.newPerDay, (v) => { store.settings.newPerDay = v; saveStore(); });

  buildSeg('direction-seg', DIRECTIONS.map((d) => ({ label: d.label, value: d.id })),
    store.settings.direction, (v) => { store.settings.direction = v; saveStore(); });

  const pf = document.getElementById('opt-pinyin-front');
  pf.checked = store.settings.pinyinFront;
  pf.onchange = () => { store.settings.pinyinFront = pf.checked; saveStore(); };

  const as = document.getElementById('opt-autospeak');
  as.checked = store.settings.autoSpeak;
  as.onchange = () => { store.settings.autoSpeak = as.checked; saveStore(); };
}

function openSettings() { renderSettings(); show('settings'); }

// ---------------------------------------------------------------- data import/export
function exportData() {
  const blob = new Blob([JSON.stringify(store)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hsk-progress-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Progress exported');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (!incoming || typeof incoming !== 'object' || !incoming.cards) throw new Error('bad');
      store = incoming;
      loadStoreNormalize();
      saveStore();
      toast('Progress imported');
      renderSettings();
    } catch (e) { toast('Invalid backup file'); }
  };
  reader.readAsText(file);
}
function loadStoreNormalize() {
  const d = defaultStore();
  store.settings = Object.assign({}, d.settings, store.settings || {});
  store.daily = store.daily || d.daily;
  store.streak = store.streak || d.streak;
  store.cards = store.cards || {};
  rolloverDay();
}

// ---------------------------------------------------------------- events
function wireEvents() {
  document.getElementById('open-settings').addEventListener('click', openSettings);
  document.getElementById('settings-back').addEventListener('click', async () => { await renderHome(); show('home'); });

  document.getElementById('start-review').addEventListener('click', startStudying);

  document.getElementById('study-back').addEventListener('click', async () => {
    await renderHome(); show('home');
  });
  document.getElementById('reveal-btn').addEventListener('click', reveal);
  document.getElementById('flashcard').addEventListener('click', (e) => {
    if (e.target.closest('.speak-btn')) return;
    if (!session.revealed) reveal();
  });
  document.getElementById('speak-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    speak(CARD_BY_ID[session.current].hanzi);
  });
  document.querySelectorAll('.grade').forEach((b) => {
    b.addEventListener('click', () => grade(b.dataset.grade));
  });

  document.getElementById('done-home').addEventListener('click', async () => { await renderHome(); show('home'); });
  document.getElementById('done-more').addEventListener('click', startStudying);

  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset ALL study progress? This cannot be undone.')) {
      store = defaultStore(); saveStore(); renderSettings(); toast('Progress reset');
    }
  });

  // keyboard shortcuts (helpful on desktop / iPad keyboards)
  document.addEventListener('keydown', (e) => {
    if (!views.study.classList.contains('active')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!session.revealed) reveal(); }
    else if (session.revealed && ['1', '2', '3', '4'].includes(e.key)) {
      grade(['again', 'hard', 'good', 'easy'][+e.key - 1]);
    }
  });

  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

async function startStudying() {
  const levels = store.settings.levels;
  await ensureLevelsLoaded(levels);
  buildSession(levels);
  if (!session.queue.length) {
    // nothing due and no new allowance — offer a quick refresher of soonest cards
    toast('Nothing scheduled — try adding a level or new cards');
    await renderHome(); show('home');
    return;
  }
  nextCard();
  show('study');
  renderCard();
}

// ---------------------------------------------------------------- boot
async function init() {
  loadStore();
  wireEvents();
  await renderHome();
  show('home');
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* offline still works once cached */ }
  }
}
init();
