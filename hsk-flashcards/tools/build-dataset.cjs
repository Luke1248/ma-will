// Build HSK 1-6 flashcard dataset by joining HSK 2.0 word lists with CC-CEDICT.
const fs = require('fs');
const path = require('path');

const PKG = path.join(__dirname, 'package');
const CEDICT = path.join(__dirname, 'node_modules', 'cc-cedict', 'data');

// --- load cc-cedict (files are `export default <json>;`) ---
function loadExportDefault(file) {
  let txt = fs.readFileSync(file, 'utf8').trim();
  txt = txt.replace(/^export\s+default\s+/, '');
  txt = txt.replace(/;\s*$/, '');
  return JSON.parse(txt);
}
const all = loadExportDefault(path.join(CEDICT, 'all.js')).all; // array of entries
const simplified = loadExportDefault(path.join(CEDICT, 'simplified.js')); // word -> {pinyin: [[idx...],[idx...]]}

// --- numbered pinyin -> tone marks ---
const toneMarks = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'],
  e: ['ē', 'é', 'ě', 'è', 'e'],
  i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
  'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};
function convertSyllable(syl) {
  const m = syl.match(/^([a-zü:A-ZÜ]+?)([1-5])$/);
  if (!m) return syl.replace(/u:/g, 'ü').replace(/5$/, '');
  let body = m[1].replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const tone = parseInt(m[2], 10) - 1; // 0-based; 4 = neutral
  // place tone on vowel: a/e first; else o in 'ou'; else last vowel
  const lower = body.toLowerCase();
  let idx = -1;
  if (lower.includes('a')) idx = lower.indexOf('a');
  else if (lower.includes('e')) idx = lower.indexOf('e');
  else if (lower.includes('ou')) idx = lower.indexOf('o');
  else {
    for (let i = body.length - 1; i >= 0; i--) {
      if ('aeiouü'.includes(lower[i])) { idx = i; break; }
    }
  }
  if (idx === -1) return body;
  const ch = body[idx];
  const isUpper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
  const key = ch.toLowerCase();
  if (!toneMarks[key]) return body;
  let marked = toneMarks[key][tone];
  if (isUpper) marked = marked.toUpperCase();
  return body.slice(0, idx) + marked + body.slice(idx + 1);
}
function prettyPinyin(numbered) {
  const sylls = numbered.split(/\s+/).map(convertSyllable);
  // join erhua: a trailing standalone "r" attaches to the previous syllable
  const merged = [];
  for (const s of sylls) {
    if (s === 'r' && merged.length) merged[merged.length - 1] += 'r';
    else merged.push(s);
  }
  return merged.join(' ').replace(/\s+/g, ' ').trim();
}

// reference-only senses point at another headword instead of giving a meaning
const REF_RE = /^(variant of|old variant of|erhua variant of|see|see also|used in|abbr\. for)\b\s*(.*)$/i;

// "趙|赵[zhao4]" -> simplified target "赵"; bare "词[ci2]" -> "词"
function refTarget(tail) {
  if (!tail) return null;
  let tok = tail.split(/[\s,;]/)[0];
  tok = tok.replace(/\[[^\]]*\]/g, '');
  if (tok.includes('|')) tok = tok.split('|')[1];
  tok = tok.replace(/[，。、,.]/g, '').trim();
  return tok || null;
}

// turn one cedict def field into an array of clean sense strings
function toSenses(def) {
  if (!def) return [];
  if (Array.isArray(def)) def = def.join('/');
  if (typeof def !== 'string') return [];
  return def
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^(CL:|Taiwan pr\.)/.test(s))
    .map((s) => s.replace(/(\S+?)\|(\S+?)(\[[^\]]*\])?/g, '$2').replace(/\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

function joinSenses(senses) {
  let out = senses.slice(0, 4).join('; ');
  if (out.length > 140) out = out.slice(0, 137).replace(/[;,\s]+\S*$/, '') + '…';
  return out;
}

// score a sense list: higher = more useful as a flashcard meaning
function scoreSenses(senses) {
  if (!senses.length) return -100;
  let score = 0;
  for (const s of senses) {
    if (REF_RE.test(s)) score -= 6;
    else if (/^surname\b/i.test(s)) score -= 5;
    else if (/^\(?(old|literary|archaic|dialect)\)?/i.test(s)) score -= 1;
    else score += 3 + Math.min(4, s.length / 12);
  }
  return score;
}

// strip full-width parenthetical notes used in HSK lists, e.g. 喂（叹词）-> 喂
function baseWord(w) {
  return w.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
}

// manual fills for entries CC-CEDICT lacks (grammar patterns, V-O phrases, variants)
const OVERRIDES = {
  '因为……所以……': { pinyin: 'yīnwèi…… suǒyǐ……', english: 'because… (therefore)…' },
  '打篮球': { pinyin: 'dǎ lánqiú', english: 'to play basketball' },
  '虽然……但是……': { pinyin: 'suīrán…… dànshì……', english: 'although…, (but)…' },
  '踢足球': { pinyin: 'tī zúqiú', english: 'to play football / soccer' },
  '不但……而且……': { pinyin: 'bùdàn…… érqiě……', english: 'not only…, but also…' },
  '只有……才……': { pinyin: 'zhǐyǒu…… cái……', english: 'only if…, then…' },
  '弹钢琴': { pinyin: 'tán gāngqín', english: 'to play the piano' },
  '桔子': { pinyin: 'júzi', english: 'tangerine; orange (variant of 橘子)' },
  '系领带': { pinyin: 'jì lǐngdài', english: 'to tie a necktie' },
  '纪录': { pinyin: 'jìlù', english: 'record (e.g. world record); to record' },
  '做主': { pinyin: 'zuòzhǔ', english: 'to make the decision; to take charge of' },
  '涮火锅': { pinyin: 'shuàn huǒguō', english: 'to eat hotpot; to cook in a hotpot' },
  '纽扣儿': { pinyin: 'niǔkòur', english: 'button' },
  '贤惠': { pinyin: 'xiánhuì', english: 'virtuous and capable (of a woman)' },
};

// gather every (reading, senses) candidate for a simplified headword
function candidates(key) {
  const entry = simplified[key];
  if (!entry) return [];
  const out = [];
  for (const reading of Object.keys(entry)) {
    const idxs = [].concat(...entry[reading]);
    for (const i of idxs) {
      const rec = all[i];
      if (!rec) continue;
      out.push({ reading, senses: toSenses(rec[3]) });
    }
  }
  return out;
}

// resolve a reference-only sense ("variant of X") to X's real meaning, one hop
function resolveRefs(senses, depth) {
  if (depth > 1) return senses;
  const resolved = [];
  for (const s of senses) {
    const m = s.match(REF_RE);
    if (m) {
      const tgt = refTarget(m[2]);
      if (tgt && tgt !== '') {
        const cands = candidates(tgt);
        // pick target's best sense list
        let best = null, bestScore = -1e9;
        for (const c of cands) {
          const cs = resolveRefs(c.senses, depth + 1);
          const sc = scoreSenses(cs);
          if (sc > bestScore) { bestScore = sc; best = cs; }
        }
        if (best && scoreSenses(best) > 0) { resolved.push(...best); continue; }
      }
    }
    resolved.push(s);
  }
  return resolved;
}

let missing = [];
function lookup(word) {
  if (OVERRIDES[word]) return OVERRIDES[word];
  const key = baseWord(word);
  const cands = candidates(key);
  if (!cands.length) return null;

  let best = null, bestScore = -1e9;
  for (const c of cands) {
    const senses = resolveRefs(c.senses, 0);
    const sc = scoreSenses(senses);
    if (sc > bestScore) { bestScore = sc; best = { reading: c.reading, senses }; }
  }
  if (!best) best = { reading: cands[0].reading, senses: cands[0].senses };
  return { pinyin: prettyPinyin(best.reading), english: joinSenses(best.senses) };
}

const out = { meta: { source: 'HSK 2.0 wordlists + CC-CEDICT', levels: {} }, cards: [] };
let id = 0;
for (let lvl = 1; lvl <= 6; lvl++) {
  const words = JSON.parse(fs.readFileSync(path.join(PKG, `HSK2.0_words_level${lvl}.json`), 'utf8'));
  let resolved = 0;
  for (const w of words) {
    const hanzi = baseWord(w);
    const info = lookup(w);
    if (info && info.english) resolved++;
    else missing.push(`L${lvl}:${w}`);
    out.cards.push({
      id: id++,
      hanzi,
      pinyin: info ? info.pinyin : '',
      english: info ? info.english : '',
      level: lvl,
    });
  }
  out.meta.levels[lvl] = { total: words.length, resolved };
}

const OUTDIR = process.env.OUTDIR || '/tmp/hsk_data';
fs.mkdirSync(OUTDIR, { recursive: true });
for (let lvl = 1; lvl <= 6; lvl++) {
  const cards = out.cards.filter((c) => c.level === lvl);
  const f = path.join(OUTDIR, `hsk${lvl}.json`);
  fs.writeFileSync(f, JSON.stringify(cards));
  console.log(`hsk${lvl}.json: ${cards.length} cards, ${(fs.statSync(f).size / 1024).toFixed(1)} KB`);
}
fs.writeFileSync(path.join(OUTDIR, 'meta.json'), JSON.stringify(out.meta, null, 2));
console.log('total cards:', out.cards.length);
console.log('levels:', JSON.stringify(out.meta.levels));
console.log('missing definitions:', missing.length);
console.log('sample missing:', missing.slice(0, 30).join(', '));
