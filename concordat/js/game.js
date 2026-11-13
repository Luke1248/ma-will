// Game controller: players, diplomacy (scripted and LLM), phase progression,
// persistence. No DOM in here.
import { PROV, SCS, NP, WIN_SCS, DEFAULT_POWERS, adjFor } from './map.js';
import { newGame, stepOrders, stepRetreats, stepBuilds, scCount, unitsOf, alive, buildDeltas, buildSites, fmtOrder, parseOrder, isValid, clone } from './rules.js';
import { planAll, planRetreats, planBuilds } from './ai.js';
import { chatJson, loadProfiles } from './llm.js';

const SAVE = 'concordat.game';
const PERSONAS = [
  'patient and loyal, but punishes betrayal without mercy',
  'charming and opportunistic; keeps deals only while they pay',
  'cautious and defensive; slow to trust, slow to attack',
  'an aggressive expansionist who respects only strength',
  'a balance-of-power thinker who always organises against the leader',
  'a methodical alliance-builder who keeps promises until the endgame',
  'a bold gambler who likes surprising, decisive strokes',
];
const clamp = (x) => Math.max(-1, Math.min(1, x));
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
export const seasonName = (s) => `${s.season === 'spring' ? 'Spring' : 'Fall'}, Year ${s.year}`;

export function createGame(powers, settings = {}) {
  const personas = [...PERSONAS].sort(() => Math.random() - 0.5);
  return {
    v: 1, state: newGame(),
    powers: powers.map((p, i) => ({ ...DEFAULT_POWERS[i], level: 'hard', ctrl: 'engine', ...p, persona: personas[i] })),
    rel: Array.from({ length: NP }, () => Array(NP).fill(0)),
    treaties: [], messages: [], history: [], betray: {},
    llm: { stance: {}, notes: {} }, llmError: null, dipDone: '',
    settings: { negRounds: 1, llmOrders: true, ...settings },
  };
}
export function saveGame(G) { try { localStorage.setItem(SAVE, JSON.stringify(G)); } catch { /* storage unavailable */ } }
export function loadGame() { try { return JSON.parse(localStorage.getItem(SAVE)); } catch { return null; } }
export function clearGame() { try { localStorage.removeItem(SAVE); } catch { /* ignore */ } }

export const isHuman = (G, k) => G.powers[k].ctrl === 'human';
export const isLLM = (G, k) => G.powers[k].ctrl.startsWith('llm:');
export const profileOf = (G, k) => loadProfiles().find((p) => 'llm:' + p.id === G.powers[k].ctrl) || null;
export const treatyBetween = (G, a, b) => G.treaties.find((t) => (t.a === a && t.b === b) || (t.a === b && t.b === a));
const nameOf = (G, k) => G.powers[k].name;
const findPower = (G, name) => {
  const n = String(name || '').trim().toLowerCase();
  let i = G.powers.findIndex((p) => p.name.toLowerCase() === n);
  if (i < 0) i = G.powers.findIndex((p) => n && (p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase())));
  return i;
};

export function stanceMatrix(G) {
  const s = Array.from({ length: NP }, () => Array(NP).fill(0));
  for (let k = 0; k < NP; k++) for (let q = 0; q < NP; q++) {
    if (k === q) continue;
    const ls = G.llm.stance[k];
    if (isLLM(G, k) && ls && typeof ls[q] === 'number') { s[k][q] = clamp(ls[q]); continue; }
    let x = G.rel[k][q];
    const t = treatyBetween(G, k, q);
    if (t) x += t.type === 'alliance' ? 0.8 : 0.6;
    for (const a of G.treaties) if (a.type === 'alliance' && a.vs === q && (a.a === k || a.b === k)) x -= 0.5;
    if (G.betray[`${k}-${q}`]) x = -0.7;
    s[k][q] = clamp(x);
  }
  return s;
}

export function post(G, from, to, text, extra = {}) {
  const m = { id: G.messages.length + 1, from, to, text, year: G.state.year, season: G.state.season, ...extra };
  G.messages.push(m); return m;
}
export const thread = (G, a, b) => G.messages.filter((m) => (m.from === a && m.to === b) || (m.from === b && m.to === a));
export const unreadFor = (G, k, from) => G.messages.filter((m) => m.to === k && m.from === from && !m.read).length;

// ---- Who must act ---------------------------------------------------------
export function humansToAct(G) {
  const s = G.state, out = [];
  for (let k = 0; k < NP; k++) {
    if (!isHuman(G, k)) continue;
    if (s.phase === 'orders' && unitsOf(s, k).length) out.push(k);
    if (s.phase === 'retreats' && Object.values(s.dislodged).some((d) => d.power === k)) out.push(k);
    if (s.phase === 'builds') { const d = buildDeltas(s)[k]; if (d < 0 || (d > 0 && buildSites(s, k).length)) out.push(k); }
  }
  return out;
}

// ---- Scripted (engine) diplomacy -----------------------------------------
function engineConsiders(G, k, from, type, vs) {
  const s = G.state;
  if (treatyBetween(G, k, from) && type === 'peace') return false;
  if (G.rel[k][from] < -0.4 || scCount(s, from) >= 12) return false;
  if (type === 'alliance') { if (vs == null || vs === k || vs === from || treatyBetween(G, k, vs) || G.rel[k][vs] > 0.4) return false; }
  return true;
}
function makeTreaty(G, a, b, type, vs) {
  G.treaties = G.treaties.filter((t) => !((t.a === a && t.b === b) || (t.a === b && t.b === a)));
  G.treaties.push({ a, b, type, vs: type === 'alliance' ? vs : null, year: G.state.year });
}
const propText = (G, type, vs) => (type === 'alliance' ? `I propose an alliance against ${nameOf(G, vs)}: we do not attack each other and we both press ${nameOf(G, vs)}.` : 'I propose a non-aggression pact: neither of us moves against the other.');

// A human (or scripted AI) formally proposes a pact.
export async function propose(G, from, to, type, vs, hooks) {
  const m = post(G, from, to, propText(G, type, vs), { proposal: { type, vs: vs ?? null, status: 'pending' } });
  if (isHuman(G, to)) return m; // waits for the human to answer
  if (isLLM(G, to)) { m.proposal.status = 'informal'; await llmReply(G, to, from, hooks); return m; }
  if (engineConsiders(G, to, from, type, vs)) { m.proposal.status = 'accepted'; makeTreaty(G, from, to, type, vs); post(G, to, from, type === 'alliance' ? `Agreed. ${nameOf(G, vs)} has it coming.` : 'Agreed. Peace between us.'); }
  else { m.proposal.status = 'declined'; post(G, to, from, rnd(['I cannot commit to that right now.', 'Not at this time.', 'My position does not allow it.'])); }
  return m;
}
export function answerProposal(G, msgId, accept) {
  const m = G.messages.find((x) => x.id === msgId); if (!m || !m.proposal || m.proposal.status !== 'pending') return;
  m.proposal.status = accept ? 'accepted' : 'declined';
  if (accept) makeTreaty(G, m.from, m.to, m.proposal.type, m.proposal.vs);
  post(G, m.to, m.from, accept ? 'Accepted.' : 'Declined.');
  if (!accept && !isHuman(G, m.from)) G.rel[m.from][m.to] = clamp(G.rel[m.from][m.to] - 0.1);
}
export function cancelTreaty(G, a, b) {
  if (!treatyBetween(G, a, b)) return;
  G.treaties = G.treaties.filter((t) => !((t.a === a && t.b === b) || (t.a === b && t.b === a)));
  post(G, a, b, 'I am ending our pact, effective now.');
  G.rel[b][a] = clamp(G.rel[b][a] - 0.15);
}

function scriptedDiplomacy(G, hooks) {
  const s = G.state, jobs = [];
  let leader = 0; for (let k = 1; k < NP; k++) if (scCount(s, k) > scCount(s, leader)) leader = k;
  for (let k = 0; k < NP; k++) {
    if (isHuman(G, k) || isLLM(G, k) || !alive(s, k)) continue;
    const nb = [(k + 1) % NP, (k + NP - 1) % NP].filter((q) => alive(s, q) && !treatyBetween(G, k, q));
    if (s.year === 1 && s.season === 'spring' && nb.length && Math.random() < 0.8) jobs.push([k, rnd(nb), 'peace', null]);
    else if (s.season === 'spring' && scCount(s, leader) >= 9 && leader !== k && Math.random() < 0.5) {
      const partners = [...Array(NP).keys()].filter((q) => q !== k && q !== leader && alive(s, q) && !treatyBetween(G, k, q) && G.rel[k][q] > -0.4);
      if (partners.length) jobs.push([k, rnd(partners), 'alliance', leader]);
    }
    // Decide quietly whether to turn on a partner.
    for (const t of G.treaties) {
      if (t.a !== k && t.b !== k) continue; const q = t.a === k ? t.b : t.a;
      if (scCount(s, q) >= 12 || (s.year >= 3 && Math.random() < 0.05 + 0.02 * Math.max(0, scCount(s, q) - scCount(s, k)))) G.betray[`${k}-${q}`] = true;
    }
  }
  return jobs.reduce((p, [a, b, type, vs]) => p.then(() => propose(G, a, b, type, vs, hooks)), Promise.resolve());
}

// ---- LLM diplomacy --------------------------------------------------------
const RULES = `Concordat is a seven-player strategy game of negotiation and simultaneous movement on a ring-shaped continent around an inner sea, with an outer ocean.
- 35 supply centres; controlling ${WIN_SCS} wins. Each power fields one unit per centre it owns.
- Units are armies (A, land) or fleets (F, seas and coastal provinces). One unit per province, every unit has strength 1.
- Each season every unit is ordered to hold, move, support another unit's hold or move (+1 strength, cut if the supporter is attacked from elsewhere), or (fleets at sea) convoy an army.
- All orders are secret and resolve simultaneously; equal strength bounces. Dislodged units retreat or disband.
- Centre ownership changes only after Fall, to whoever occupies it. Then powers build in their own empty home centres or disband to match.
- Negotiation is unrestricted and nothing said is binding. Trust, timing and betrayal decide the game.
Order notation: "A VAL - GRE" (move), "A VAL H" (hold), "F SER S A VAL - GRE" (support move), "A OMB S A VAL" (support hold), "F GLA C A SER - ILM" (convoy).`;

function boardText(G) {
  const s = G.state, lines = [`Current phase: ${seasonName(s)}.`];
  for (let k = 0; k < NP; k++) {
    if (!alive(s, k)) { lines.push(`${nameOf(G, k)}: eliminated.`); continue; }
    const scs = SCS.filter((c) => s.owners[c] === k), us = unitsOf(s, k).map((p) => `${s.units[p].type} ${p}`);
    lines.push(`${nameOf(G, k)}: ${scs.length} centres [${scs.join(' ')}]; units: ${us.join(', ') || 'none'}`);
  }
  const free = SCS.filter((c) => s.owners[c] == null);
  if (free.length) lines.push(`Unowned centres: ${free.join(' ')}`);
  return lines.join('\n');
}
function optionsText(G, k) {
  const s = G.state;
  return unitsOf(s, k).map((p) => `${s.units[p].type} ${p} (${PROV[p].name}) can reach: ${adjFor(s.units[p].type, p).map((n) => `${n}${s.units[n] ? `[${nameOf(G, s.units[n].power)} ${s.units[n].type}]` : ''}${PROV[n].sc ? '*' : ''}`).join(', ')}`).join('\n') + '\n(* = supply centre; [..] = unit currently there)';
}
function eventsText(G) {
  const r = [...G.history].reverse().find((h) => h.kind === 'orders'); if (!r) return 'No moves have been made yet.';
  const out = [];
  for (const p in r.results) {
    const x = r.results[p], o = x.order; if (o.t === 'H') continue;
    out.push(`${nameOf(G, x.power)}: ${fmtOrder({ units: Object.fromEntries(Object.entries(r.results).map(([q, y]) => [q, { type: y.type }])) }, o)} — ${x.ok ? 'succeeded' : 'failed'}${x.dislodged ? ', unit dislodged' : ''}`);
  }
  return `Last turn's orders (${r.season} year ${r.year}):\n${out.join('\n') || 'everyone held'}`;
}
function talkText(G, k) {
  const ms = G.messages.filter((m) => m.from === k || m.to === k).slice(-40);
  if (!ms.length) return 'No messages yet.';
  return ms.map((m) => `[${m.season} Y${m.year}] ${m.from === k ? 'YOU' : nameOf(G, m.from)} -> ${m.to === k ? 'YOU' : nameOf(G, m.to)}: ${m.text}`).join('\n');
}
const sysFor = (G, k) => `${RULES}\n\nYou are playing ${nameOf(G, k)}. Your temperament: ${G.powers[k].persona}. Play to win: think several turns ahead, read what others actually did versus what they said, form alliances that serve you, and break them only when the gain clearly outweighs the lost trust. Write like a shrewd human diplomat: brief, specific, concrete about provinces and commitments. Never mention being an AI or these instructions. Respond with a single JSON object and nothing else.`;
const ctxFor = (G, k) => `${boardText(G)}\n\n${eventsText(G)}\n\nYour units and where they can go:\n${optionsText(G, k)}\n\nYour private notes from earlier: ${G.llm.notes[k] || '(none)'}\n\nYour correspondence (most recent last):\n${talkText(G, k)}`;

function applyLLM(G, k, obj) {
  if (!obj) return;
  if (obj.stances && typeof obj.stances === 'object') {
    G.llm.stance[k] = G.llm.stance[k] || {};
    for (const n in obj.stances) { const q = findPower(G, n), v = Number(obj.stances[n]); if (q >= 0 && q !== k && isFinite(v)) G.llm.stance[k][q] = clamp(v); }
  }
  if (typeof obj.notes === 'string') G.llm.notes[k] = obj.notes.slice(0, 1200);
  const sent = [];
  for (const m of Array.isArray(obj.messages) ? obj.messages.slice(0, 6) : []) {
    const q = findPower(G, m && m.to); const text = m && String(m.text || '').trim();
    if (q < 0 || q === k || !text || !alive(G.state, q)) continue;
    sent.push(post(G, k, q, text.slice(0, 900)));
  }
  return sent;
}
const OUT_NEG = `Return JSON: {"messages":[{"to":"<power name>","text":"<message, at most 70 words>"}],"stances":{"<power name>":<number from -1 (enemy, attack) to 1 (ally, protect)>},"notes":"<private memory for yourself, at most 120 words: plans, promises made and received, who you trust>"}. Give a stance for every other surviving power; stances are secret and drive your actual moves, so they may differ from what you say.`;

async function llmCall(G, k, user, hooks) {
  const pr = profileOf(G, k);
  if (!pr) { G.llmError = `${nameOf(G, k)}: model profile missing — using the built-in engine.`; return null; }
  try { const o = await chatJson(pr, sysFor(G, k), user); return o; }
  catch (e) { G.llmError = `${nameOf(G, k)} (${pr.label}): ${e.message}`; if (hooks && hooks.onError) hooks.onError(G.llmError); return null; }
}
async function llmNegotiate(G, k, hooks) {
  const o = await llmCall(G, k, `${ctxFor(G, k)}\n\nIt is the negotiation period before orders. Send messages to the powers you want to talk to (zero to four messages; answer anything addressed to you that deserves an answer; do not repeat yourself).\n${OUT_NEG}`, hooks);
  applyLLM(G, k, o); if (hooks && hooks.onUpdate) hooks.onUpdate();
}
async function llmReply(G, k, from, hooks) {
  const o = await llmCall(G, k, `${ctxFor(G, k)}\n\n${nameOf(G, from)} has just written to you (the last message above). Reply to them now; you may also write to others if it serves you.\n${OUT_NEG}`, hooks);
  const sent = applyLLM(G, k, o) || [];
  if (o && !sent.some((m) => m.to === from) && isHuman(G, from)) post(G, k, from, '(no reply)');
  if (hooks && hooks.onUpdate) hooks.onUpdate();
}

// Human free-text message.
export async function sendMessage(G, from, to, text, hooks) {
  post(G, from, to, text);
  if (hooks && hooks.onUpdate) hooks.onUpdate();
  if (isLLM(G, to)) await llmReply(G, to, from, hooks);
  else if (!isHuman(G, to)) post(G, to, from, 'This power is run by the built-in engine: it answers formal proposals (use Propose) but cannot read free text. Assign it an LLM model in setup for real conversation.', { system: true });
  if (hooks && hooks.onUpdate) hooks.onUpdate();
}

// Run once at the start of each orders phase. Resolves when the AIs are done talking.
export async function beginDiplomacy(G, hooks) {
  const tag = `${G.state.year}${G.state.season}`;
  if (G.state.phase !== 'orders' || G.dipDone === tag) return;
  G.dipDone = tag;
  await scriptedDiplomacy(G, hooks);
  const bots = [...Array(NP).keys()].filter((k) => isLLM(G, k) && alive(G.state, k));
  for (let r = 0; r < G.settings.negRounds && bots.length; r++) await Promise.all(bots.map((k) => llmNegotiate(G, k, hooks)));
  if (hooks && hooks.onUpdate) hooks.onUpdate();
}

// ---- Resolution -----------------------------------------------------------
function updateRelations(G, prev, report) {
  const hostile = new Set(), friendly = new Set();
  const victimOf = (actor, d) => {
    const u = prev.units[d], o = prev.owners[d];
    if (u && u.power !== actor) return u.power;
    if (PROV[d].sc && o != null && o !== actor) return o;
    return null;
  };
  for (const p in report.results) {
    const x = report.results[p], o = x.order;
    if (o.t === 'M') { const v = victimOf(x.power, o.to); if (v != null) hostile.add(`${x.power}-${v}`); }
    if (o.t === 'S') {
      const sp = prev.units[o.from] && prev.units[o.from].power;
      if (o.to !== o.from) { const v = victimOf(sp, o.to); if (v != null && v !== x.power) hostile.add(`${x.power}-${v}`); }
      if (sp != null && sp !== x.power && x.ok) friendly.add(`${x.power}-${sp}`);
    }
  }
  const events = [];
  for (const h of hostile) {
    const [a, b] = h.split('-').map(Number);
    G.rel[b][a] = clamp(G.rel[b][a] - 0.35);
    const t = treatyBetween(G, a, b);
    if (t) {
      G.treaties = G.treaties.filter((x) => x !== t); G.rel[b][a] = -1; delete G.betray[`${a}-${b}`];
      for (let c = 0; c < NP; c++) if (c !== a && c !== b) G.rel[c][a] = clamp(G.rel[c][a] - 0.12);
      events.push(`${nameOf(G, a)} broke its pact with ${nameOf(G, b)}.`);
    }
  }
  for (const f of friendly) { const [a, b] = f.split('-').map(Number); G.rel[b][a] = clamp(G.rel[b][a] + 0.2); }
  for (let k = 0; k < NP; k++) for (let q = 0; q < NP; q++) {
    if (k === q) continue; G.rel[k][q] *= 0.93;
    const n = scCount(G.state, q); if (n >= 11) G.rel[k][q] = clamp(G.rel[k][q] - 0.08 * (n - 10));
  }
  return events;
}

async function llmPickOrders(G, k, ranked, hooks) {
  const s = G.state, top = ranked.slice(0, 6);
  const list = top.map((c, i) => `Option ${i + 1} (engine score ${c.score.toFixed(2)}): ${c.orders.map((o) => fmtOrder(s, o)).join('; ')}`).join('\n');
  const o = await llmCall(G, k, `${ctxFor(G, k)}\n\nOrders are due. A tactical engine proposes these order sets for you, best first by its own estimate (it does not know what you promised or what you suspect):\n${list}\n\nChoose the set that best fits your strategy and the deals you intend to keep or break, and optionally replace individual orders (for example to give a support you promised).\nReturn JSON: {"choice":<option number>,"overrides":["<order in notation>", ...],"notes":"<updated private memory, at most 120 words>"}`, hooks);
  if (!o) return null;
  if (typeof o.notes === 'string') G.llm.notes[k] = o.notes.slice(0, 1200);
  const idx = Math.max(1, Math.min(top.length, Math.round(Number(o.choice)) || 1)) - 1;
  const orders = top[idx].orders.map((x) => ({ ...x }));
  for (const t of Array.isArray(o.overrides) ? o.overrides.slice(0, 20) : []) {
    const po = parseOrder(t);
    if (!po || !s.units[po.p] || s.units[po.p].power !== k || !isValid(s, po)) continue;
    const i = orders.findIndex((x) => x.p === po.p); if (i >= 0) orders[i] = po; else orders.push(po);
  }
  return orders;
}

// humanOrders: {k: [orders]}
export async function resolveOrders(G, humanOrders, hooks = {}) {
  const prev = clone(G.state), stance = stanceMatrix(G);
  const plan = await planAll(prev, stance, (k) => (isHuman(G, k) ? 'normal' : isLLM(G, k) ? 'hard' : G.powers[k].level), humanOrders, hooks.onProgress);
  const all = [], picks = [];
  for (const k in plan) {
    if (humanOrders[k]) { all.push(...humanOrders[k]); continue; }
    if (isLLM(G, +k) && G.settings.llmOrders) picks.push(llmPickOrders(G, +k, plan[k].ranked, hooks).then((o) => all.push(...(o || plan[k].best))));
    else all.push(...plan[k].best);
  }
  if (picks.length && hooks.onStage) hooks.onStage('Awaiting orders from the model-run powers…');
  await Promise.all(picks);
  const { state, report } = stepOrders(prev, all);
  G.state = state;
  report.before = { units: prev.units };
  report.events = updateRelations(G, prev, report);
  G.history.push(report);
  return report;
}

export function resolveRetreats(G, humanRetreats = {}) {
  const stance = stanceMatrix(G), all = { ...humanRetreats };
  for (let k = 0; k < NP; k++) if (!isHuman(G, k)) Object.assign(all, planRetreats(G.state, k, stance));
  const { state, report } = stepRetreats(G.state, all);
  G.state = state; G.history.push(report); return report;
}
export function resolveBuilds(G, humanBuilds = [], humanDisbands = []) {
  const stance = stanceMatrix(G), b = [...humanBuilds], d = [...humanDisbands];
  for (let k = 0; k < NP; k++) if (!isHuman(G, k)) { const x = planBuilds(G.state, k, stance); b.push(...x.builds); d.push(...x.disbands); }
  const { state, report } = stepBuilds(G.state, b, d);
  G.state = state; G.history.push(report); return report;
}

export { scCount, unitsOf, alive, buildDeltas, buildSites, fmtOrder, WIN_SCS };
