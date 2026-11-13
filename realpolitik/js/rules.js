// Realpolitik rules engine: order validation, simultaneous adjudication,
// retreats, adjustments and the turn cycle. Pure functions, no DOM.
import { PROV, IDS, SCS, HOMES, NP, WIN_SCS, adjFor, isSea, isCoast, startingUnits } from './map.js';

// Order shapes (p = ordered unit's province):
//   {p, t:'H'}                       hold
//   {p, t:'M', to}                   move (armies convoy automatically when not adjacent)
//   {p, t:'S', from, to}             support unit at `from` into `to` (to === from: support hold)
//   {p, t:'C', from, to}             fleet convoys army at `from` to `to`

export function newGame() {
  const owners = {};
  for (const sc of SCS) owners[sc] = PROV[sc].home;
  return { year: 1, season: 'spring', phase: 'orders', units: startingUnits(), owners, dislodged: {}, contested: [], winner: null };
}

export const clone = (o) => JSON.parse(JSON.stringify(o));
export const scCount = (s, k) => SCS.filter((id) => s.owners[id] === k).length;
export const unitsOf = (s, k) => Object.keys(s.units).filter((p) => s.units[p].power === k);
export const alive = (s, k) => scCount(s, k) > 0 || unitsOf(s, k).length > 0;

// Provinces an army at `from` could reach by convoy over fleets currently at sea.
// filter(seaId) limits which fleets may be used.
export function convoyReach(units, from, filter = () => true) {
  const out = new Set();
  if (!isCoast(from)) return out;
  const seen = new Set(), q = [];
  for (const s of PROV[from].fAdj) if (isSea(s) && units[s] && units[s].type === 'F' && filter(s)) { seen.add(s); q.push(s); }
  while (q.length) {
    const s = q.shift();
    for (const n of PROV[s].fAdj) {
      if (isSea(n)) { if (!seen.has(n) && units[n] && units[n].type === 'F' && filter(n)) { seen.add(n); q.push(n); } }
      else if (n !== from) out.add(n);
    }
  }
  return out;
}

export function moveTargets(state, p) {
  const u = state.units[p]; if (!u) return [];
  const t = new Set(adjFor(u.type, p));
  if (u.type === 'A') for (const c of convoyReach(state.units, p)) t.add(c);
  return [...t];
}

export function isValid(state, o) {
  const u = state.units[o.p]; if (!u) return false;
  if (o.t === 'H') return true;
  if (o.t === 'M') return !!o.to && o.to !== o.p && moveTargets(state, o.p).includes(o.to);
  if (o.t === 'S') {
    if (!state.units[o.from] || o.from === o.p || o.to === o.p) return false;
    if (!adjFor(u.type, o.p).includes(o.to)) return false;
    return o.to === o.from || moveTargets(state, o.from).includes(o.to);
  }
  if (o.t === 'C') {
    const a = state.units[o.from];
    return u.type === 'F' && isSea(o.p) && !!a && a.type === 'A' && isCoast(o.from) && isCoast(o.to) && o.from !== o.to;
  }
  return false;
}

export function adjudicate(state, orderList) {
  const units = state.units, ord = {};
  for (const p in units) ord[p] = { p, t: 'H' };
  for (const o of orderList || []) if (units[o.p] && isValid(state, o)) ord[o.p] = { ...o };
  const movesTo = {};
  for (const p in ord) {
    const o = ord[p];
    if (o.t === 'M') {
      o.convoy = units[p].type === 'A' && !PROV[p].aAdj.includes(o.to);
      (movesTo[o.to] = movesTo[o.to] || []).push(p);
    }
  }
  const supportsOf = {};
  for (const p in ord) {
    const o = ord[p]; if (o.t !== 'S') continue;
    const t = ord[o.from];
    o.matched = o.to === o.from ? t.t !== 'M' : (t.t === 'M' && t.to === o.to);
    if (o.matched) (supportsOf[o.from] = supportsOf[o.from] || []).push(p);
  }

  const UN = 0, GUESS = 1, DONE = 2;
  const st = {}, res = {}; let deps = [];
  for (const p in ord) st[p] = UN;

  function resolve(p) {
    if (st[p] === DONE) return res[p];
    if (st[p] === GUESS) { if (!deps.includes(p)) deps.push(p); return res[p]; }
    const old = deps.length;
    res[p] = false; st[p] = GUESS;
    const first = adj(p);
    if (deps.length === old) { if (st[p] !== DONE) { res[p] = first; st[p] = DONE; } return res[p]; }
    if (deps[old] !== p) { deps.push(p); res[p] = first; return first; }
    for (let i = old; i < deps.length; i++) st[deps[i]] = UN;
    deps.length = old;
    res[p] = true; st[p] = GUESS;
    const second = adj(p);
    if (first === second) {
      for (let i = old; i < deps.length; i++) st[deps[i]] = UN;
      deps.length = old; res[p] = first; st[p] = DONE; return first;
    }
    // Paradox or circular movement.
    const cyc = deps.slice(old); if (!cyc.includes(p)) cyc.push(p);
    deps.length = old;
    const hasConvoy = cyc.some((q) => ord[q].t === 'C');
    let progress = false;
    const fix = (q, v) => { res[q] = v; st[q] = DONE; progress = true; };
    for (const q of cyc) st[q] = UN;
    for (const q of cyc) {
      if (hasConvoy) {
        // Convoy paradox: the convoyed moves involved fail.
        if (ord[q].t === 'M' && ord[q].convoy) fix(q, false);
        else if (ord[q].t === 'C' && ord[ord[q].from] && ord[ord[q].from].t === 'M' && ord[ord[q].from].convoy) fix(ord[q].from, false);
      } else if (ord[q].t === 'M') fix(q, true); // circular movement
    }
    if (!progress) fix(p, false);
    return resolve(p);
  }

  function path(p) {
    const o = ord[p]; if (!o.convoy) return true;
    return convoyReach(units, p, (s) => ord[s].t === 'C' && ord[s].from === p && ord[s].to === o.to && resolve(s)).has(o.to);
  }
  const supCount = (p, exclPower) => (supportsOf[p] || []).filter((s) => (exclPower == null || units[s].power !== exclPower) && resolve(s)).length;
  const h2hOf = (p) => { // province of the unit p is in head-to-head battle with, or null
    const o = ord[p], d = ord[o.to];
    return d && d.t === 'M' && d.to === p && !o.convoy && !d.convoy ? o.to : null;
  };
  function holdStrength(d) {
    if (!units[d]) return 0;
    if (ord[d].t === 'M') return resolve(d) ? 0 : 1;
    return 1 + supCount(d, null);
  }
  function preventStrength(q) {
    if (!path(q)) return 0;
    const h = h2hOf(q);
    if (h && resolve(h)) return 0;
    return 1 + supCount(q, null);
  }
  function adj(p) {
    const o = ord[p], u = units[p];
    if (o.t === 'H') return true;
    if (o.t === 'C') return !(movesTo[p] || []).some((q) => resolve(q));
    if (o.t === 'S') {
      if (!o.matched) return false;
      for (const q of movesTo[p] || []) {
        if (units[q].power === u.power) continue;
        if (q !== o.to && path(q)) return false;
        if (resolve(q)) return false;
      }
      return true;
    }
    if (!path(p)) return false;
    const d = o.to, occ = units[d], h = h2hOf(p);
    let attack;
    const leaving = occ && ord[d].t === 'M' && !h && resolve(d);
    if (occ && !leaving) attack = occ.power === u.power ? 0 : 1 + supCount(p, occ.power);
    else attack = 1 + supCount(p, null);
    const oppose = h ? 1 + supCount(h, null) : holdStrength(d);
    if (attack <= oppose) return false;
    for (const q of movesTo[d] || []) if (q !== p && attack <= preventStrength(q)) return false;
    return true;
  }

  for (const p in ord) resolve(p);

  const newUnits = {}, dislodged = {}, results = {};
  for (const p in ord) {
    results[p] = { order: ord[p], ok: ord[p].t === 'H' ? true : res[p], power: units[p].power, type: units[p].type };
    if (ord[p].t === 'M' && res[p]) newUnits[ord[p].to] = units[p];
  }
  for (const p in ord) {
    if (ord[p].t === 'M' && res[p]) continue;
    const atk = (movesTo[p] || []).find((q) => res[q]);
    if (atk) { dislodged[p] = { ...units[p], by: atk, byConvoy: !!ord[atk].convoy }; results[p].dislodged = true; }
    else newUnits[p] = units[p];
  }
  const contested = Object.keys(movesTo).filter((d) => !newUnits[d] && movesTo[d].length >= 2 && !movesTo[d].some((q) => res[q]));
  for (const p in dislodged) {
    const dl = dislodged[p];
    dl.options = adjFor(dl.type, p).filter((n) => !newUnits[n] && !contested.includes(n) && (n !== dl.by || dl.byConvoy));
  }
  return { results, newUnits, dislodged, contested };
}

// ---- Turn cycle -----------------------------------------------------------

export function buildDeltas(state) {
  const d = [];
  for (let k = 0; k < NP; k++) d.push(scCount(state, k) - unitsOf(state, k).length);
  return d;
}
export const buildSites = (state, k) => HOMES[k].filter((h) => state.owners[h] === k && !state.units[h]);

function afterRetreats(s) {
  s.dislodged = {}; s.contested = [];
  if (s.season === 'spring') { s.season = 'fall'; s.phase = 'orders'; return s; }
  for (const sc of SCS) if (s.units[sc]) s.owners[sc] = s.units[sc].power;
  let best = -1, bestN = 0;
  for (let k = 0; k < NP; k++) { const n = scCount(s, k); if (n > bestN) { bestN = n; best = k; } }
  if (bestN >= WIN_SCS) { s.winner = best; s.phase = 'over'; return s; }
  const deltas = buildDeltas(s);
  const needs = deltas.some((d, k) => d < 0 || (d > 0 && buildSites(s, k).length > 0));
  if (needs) { s.phase = 'builds'; return s; }
  return nextYear(s);
}
function nextYear(s) { s.year += 1; s.season = 'spring'; s.phase = 'orders'; return s; }

// Apply movement orders. Returns {state, report}.
export function stepOrders(state, orders) {
  const r = adjudicate(state, orders);
  const s = clone(state);
  s.units = clone(r.newUnits);
  s.dislodged = clone(r.dislodged); s.contested = r.contested;
  const report = { kind: 'orders', year: state.year, season: state.season, results: clone(r.results), dislodged: clone(r.dislodged) };
  if (Object.keys(r.dislodged).length) s.phase = 'retreats'; else afterRetreats(s);
  return { state: s, report };
}

// retreats: {PROV: destination | null(disband)}
export function stepRetreats(state, retreats) {
  const s = clone(state), want = {}, log = [];
  for (const p in s.dislodged) {
    const d = s.dislodged[p], to = retreats && retreats[p];
    if (to && d.options.includes(to)) (want[to] = want[to] || []).push(p);
    else log.push({ p, power: d.power, type: d.type, to: null });
  }
  for (const to in want) {
    if (want[to].length === 1) { const p = want[to][0], d = s.dislodged[p]; s.units[to] = { power: d.power, type: d.type }; log.push({ p, power: d.power, type: d.type, to }); }
    else for (const p of want[to]) log.push({ p, power: s.dislodged[p].power, type: s.dislodged[p].type, to: null, bounced: true });
  }
  const report = { kind: 'retreats', year: state.year, season: state.season, log };
  afterRetreats(s);
  return { state: s, report };
}

// Distance from a province to the nearest of the power's home centres.
function homeDist(k, p) {
  const seen = { [p]: 0 }, q = [p];
  while (q.length) { const c = q.shift(); if (HOMES[k].includes(c)) return seen[c]; for (const n of PROV[c].adj) if (!(n in seen)) { seen[n] = seen[c] + 1; q.push(n); } }
  return 99;
}

// builds: [{power, p, type}] ; disbands: [{power, p}]
export function stepBuilds(state, builds, disbands) {
  const s = clone(state), deltas = buildDeltas(s), log = [];
  for (let k = 0; k < NP; k++) {
    let d = deltas[k];
    if (d > 0) {
      for (const b of (builds || []).filter((b) => b.power === k)) {
        if (d <= 0) break;
        if (!buildSites(s, k).includes(b.p)) continue;
        const type = b.type === 'F' && isCoast(b.p) ? 'F' : 'A';
        s.units[b.p] = { power: k, type }; d--; log.push({ power: k, p: b.p, type, build: true });
      }
    } else if (d < 0) {
      const chosen = (disbands || []).filter((x) => x.power === k && s.units[x.p] && s.units[x.p].power === k).map((x) => x.p);
      const rest = unitsOf(s, k).filter((p) => !chosen.includes(p)).sort((a, b) => homeDist(k, b) - homeDist(k, a));
      for (const p of [...new Set(chosen), ...rest]) {
        if (d >= 0) break;
        if (!s.units[p]) continue;
        log.push({ power: k, p, type: s.units[p].type, build: false }); delete s.units[p]; d++;
      }
    }
  }
  const report = { kind: 'builds', year: state.year, season: state.season, log };
  nextYear(s);
  return { state: s, report };
}

// ---- Notation -------------------------------------------------------------

export function fmtOrder(state, o) {
  const u = state.units[o.p] || {}; const T = u.type || '?';
  if (o.t === 'M') return `${T} ${o.p} - ${o.to}`;
  if (o.t === 'S') { const su = state.units[o.from] || {}; return o.to === o.from ? `${T} ${o.p} S ${su.type || '?'} ${o.from}` : `${T} ${o.p} S ${su.type || '?'} ${o.from} - ${o.to}`; }
  if (o.t === 'C') return `${T} ${o.p} C A ${o.from} - ${o.to}`;
  return `${T} ${o.p} H`;
}

// Parse "A VAL - GRE", "F SER S A VAL - GRE", "F GLA C A SER - ILM", "A VAL H".
export function parseOrder(text) {
  const tk = String(text).toUpperCase().replace(/[^A-Z\- ]/g, ' ').replace(/-/g, ' - ').split(/\s+/).filter((x) => x && x !== 'A' && x !== 'F' && x !== 'TO');
  const isP = (x) => !!PROV[x];
  if (!isP(tk[0])) return null;
  const p = tk[0], rest = tk.slice(1);
  if (!rest.length || rest[0] === 'H' || rest[0] === 'HOLD') return { p, t: 'H' };
  if (rest[0] === '-' && isP(rest[1])) return { p, t: 'M', to: rest[1] };
  if ((rest[0] === 'S' || rest[0] === 'SUPPORT' || rest[0] === 'SUPPORTS') && isP(rest[1])) {
    if (rest[2] === '-' && isP(rest[3])) return { p, t: 'S', from: rest[1], to: rest[3] };
    return { p, t: 'S', from: rest[1], to: rest[1] };
  }
  if ((rest[0] === 'C' || rest[0] === 'CONVOY' || rest[0] === 'CONVOYS') && isP(rest[1]) && rest[2] === '-' && isP(rest[3])) return { p, t: 'C', from: rest[1], to: rest[3] };
  return null;
}

export { PROV, IDS, SCS, HOMES, NP, WIN_SCS };
