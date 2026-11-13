// Concordat tactical engine. No network, runs on device.
// Each power gets a set of candidate order sets; candidates are scored by
// adjudicating them against sampled plans of every other power, and the
// sampling distributions are refined over a few rounds of best response.
import { PROV, IDS, SCS, HOMES, NP, adjFor, isSea, isCoast } from './map.js';
import { adjudicate, scCount, unitsOf, alive, buildDeltas, buildSites, convoyReach } from './rules.js';

export const LEVELS = {
  easy:   { cands: 10, samples: 4,  rounds: 1, temp: 0.6 },
  normal: { cands: 24, samples: 8,  rounds: 2, temp: 0.15 },
  hard:   { cands: 40, samples: 14, rounds: 3, temp: 0.05 },
};

const hostility = (stance, k, q) => (q == null || q === k ? 0 : (1 - ((stance[k] && stance[k][q]) || 0)) / 2);

// Positional value of every province for power k, per unit type.
export function valueMaps(state, k, stance) {
  const base = {};
  const reach = {}; // foreign units able to reach province, weighted by hostility
  for (const p in state.units) {
    const u = state.units[p]; if (u.power === k) continue;
    const h = hostility(stance, k, u.power);
    for (const n of [p, ...adjFor(u.type, p)]) reach[n] = (reach[n] || 0) + h;
  }
  for (const sc of SCS) {
    const o = state.owners[sc];
    if (o === k) base[sc] = Math.min(1.2, 0.45 * (reach[sc] || 0)) + (PROV[sc].home === k ? 0.1 : 0);
    else if (o == null) base[sc] = 1.0;
    else {
      const h = hostility(stance, k, o);
      base[sc] = Math.max(0, 1.5 * h - 0.25) * (1 + 0.03 * scCount(state, o));
    }
  }
  const maps = {};
  for (const T of ['A', 'F']) {
    let v = {};
    for (const id of IDS) v[id] = base[id] || 0;
    for (let i = 0; i < 5; i++) {
      const n = {};
      for (const id of IDS) {
        let m = 0, sum = 0; const adj = adjFor(T, id);
        for (const a of adj) { if (v[a] > m) m = v[a]; sum += v[a]; }
        n[id] = Math.max(base[id] || 0, 0.55 * m) + 0.03 * sum;
      }
      v = n;
    }
    if (T === 'A') for (const id of IDS) if (isSea(id)) v[id] = 0;
    if (T === 'F') for (const id of IDS) if (!isSea(id) && !isCoast(id)) v[id] = 0;
    maps[T] = v;
  }
  return { A: maps.A, F: maps.F, base, reach };
}

const pickW = (items, weights) => {
  let s = 0; for (const w of weights) s += w;
  let r = Math.random() * s;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const key = (orders) => orders.map((o) => `${o.p}${o.t}${o.from || ''}${o.to || ''}`).sort().join('|');

function sampleOrders(state, k, vm, stance, greedy) {
  const mine = shuffle(unitsOf(state, k)), intent = {}, T = greedy ? 0.05 : 0.22;
  for (const p of mine) {
    const u = state.units[p], v = vm[u.type];
    const opts = [p, ...adjFor(u.type, p)];
    const w = opts.map((d) => {
      let x = v[d];
      const occ = state.units[d];
      if (d === p) { x += state.season === 'fall' && PROV[p].sc && state.owners[p] !== k ? 0.6 : 0; x += PROV[p].sc && state.owners[p] === k ? 0.5 * Math.min(1, vm.reach[p] || 0) : 0; }
      else if (occ && occ.power === k) x -= 0.3;
      else if (occ && hostility(stance, k, occ.power) < 0.3) x -= 0.6;
      return Math.exp(x / T);
    });
    intent[p] = pickW(opts, w);
  }
  // Occasional one-hop convoy.
  if (!greedy && Math.random() < 0.15) {
    for (const p of mine) {
      const u = state.units[p]; if (u.type !== 'A' || !isCoast(p)) continue;
      const fleets = PROV[p].fAdj.filter((s) => isSea(s) && state.units[s] && state.units[s].power === k && intent[s] === s);
      if (!fleets.length) continue;
      const f = fleets[0];
      const dests = PROV[f].fAdj.filter((d) => !isSea(d) && d !== p && !PROV[p].aAdj.includes(d));
      if (!dests.length) continue;
      const d = dests.sort((a, b) => vm.A[b] - vm.A[a])[0];
      if (vm.A[d] > vm.A[intent[p]]) { intent[p] = d; intent[f] = { convoy: p, to: d }; break; }
    }
  }
  const orders = {}, target = {};
  for (const p of mine) {
    const d = intent[p];
    if (typeof d === 'object') { orders[p] = { p, t: 'C', from: d.convoy, to: d.to }; continue; }
    if (d === p) { orders[p] = { p, t: 'H' }; continue; }
    if (target[d]) orders[p] = { p, t: 'S', from: target[d], to: d }; // second unit to the same place supports the first
    else { target[d] = p; orders[p] = { p, t: 'M', to: d }; }
  }
  // Convert some units into supports for contested moves / threatened holds.
  for (const p of mine) {
    const o = orders[p]; if (o.t === 'C') continue;
    const u = state.units[p];
    const contested = (d) => (state.units[d] && state.units[d].power !== k) || (vm.reach[d] || 0) > 0.2;
    const cands = [];
    for (const q of mine) {
      if (q === p) continue; const oq = orders[q];
      if (oq.t === 'M' && adjFor(u.type, p).includes(oq.to) && contested(oq.to) && PROV[q].aAdj.concat(PROV[q].fAdj).includes(oq.to)) cands.push({ p, t: 'S', from: q, to: oq.to, w: vm[state.units[q].type][oq.to] + (state.units[oq.to] ? 0.5 : 0) });
      if (oq.t !== 'M' && adjFor(u.type, p).includes(q) && PROV[q].sc && (vm.reach[q] || 0) > 0.4) cands.push({ p, t: 'S', from: q, to: q, w: 0.5 + 0.3 * vm.reach[q] });
    }
    if (!cands.length) continue;
    const mineVal = o.t === 'M' ? vm[u.type][o.to] : vm[u.type][p] * 0.8;
    const c = cands.sort((a, b) => b.w - a.w)[0];
    const prob = greedy ? (c.w > mineVal ? 1 : 0) : Math.min(0.75, 0.2 + 0.4 * (c.w - mineVal + 0.5));
    if (Math.random() < prob) { if (o.t === 'M') delete target[o.to]; orders[p] = { p: c.p, t: 'S', from: c.from, to: c.to }; }
  }
  // Supports for friendly foreign units holding next to us.
  if (!greedy) for (const p of mine) {
    if (orders[p].t !== 'H' || Math.random() > 0.25) continue;
    const u = state.units[p];
    const fr = adjFor(u.type, p).filter((q) => state.units[q] && state.units[q].power !== k && hostility(stance, k, state.units[q].power) < 0.2 && PROV[q].sc);
    if (fr.length) orders[p] = { p, t: 'S', from: fr[0], to: fr[0] };
  }
  return Object.values(orders);
}

export function candidatesFor(state, k, stance, n) {
  const vm = valueMaps(state, k, stance), seen = new Set(), out = [];
  const push = (o) => { const kk = key(o); if (!seen.has(kk)) { seen.add(kk); out.push(o); } };
  push(unitsOf(state, k).map((p) => ({ p, t: 'H' })));
  push(sampleOrders(state, k, vm, stance, true));
  for (let i = 0; i < n * 3 && out.length < n; i++) push(sampleOrders(state, k, vm, stance, false));
  return { vm, list: out };
}

function scoreFor(state, k, stance, vm, r) {
  const fall = state.season === 'fall';
  let s = 0;
  for (const p in r.newUnits) {
    const u = r.newUnits[p];
    if (u.power === k) {
      s += vm[u.type][p];
      if (PROV[p].sc && state.owners[p] !== k) {
        const o = state.owners[p];
        s += (fall ? 3.0 : 1.2) * (o == null ? 1 : 0.25 + 0.75 * hostility(stance, k, o));
      }
    } else if (PROV[p].sc && state.owners[p] === k) s -= fall ? 3.0 : 1.5;
  }
  for (const p in r.dislodged) {
    const d = r.dislodged[p];
    if (d.power === k) s -= d.options.length ? 1.2 : 2.2;
    else s += 0.7 * hostility(stance, k, d.power);
  }
  return s;
}

const softmax = (xs, T) => { const m = Math.max(...xs); const e = xs.map((x) => Math.exp((x - m) / T)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const tick = () => new Promise((r) => setTimeout(r, 0));

// Joint search. Returns per power: {best, ranked:[{orders, score}]}.
// overrides: {k: orders} fixes a power's orders (e.g. humans who already submitted).
export async function planAll(state, stance, levelFor, overrides = {}, onProgress) {
  const powers = []; for (let k = 0; k < NP; k++) if (unitsOf(state, k).length) powers.push(k);
  const C = {}, pol = {}, sc = {};
  for (const k of powers) {
    const L = LEVELS[levelFor(k)] || LEVELS.normal;
    if (overrides[k]) { C[k] = { vm: valueMaps(state, k, stance), list: [overrides[k]] }; pol[k] = [1]; continue; }
    C[k] = candidatesFor(state, k, stance, L.cands);
    // Prior: score against everyone else holding.
    const pri = C[k].list.map((o) => scoreFor(state, k, stance, C[k].vm, adjudicate(state, o)));
    pol[k] = softmax(pri, 0.5); sc[k] = pri;
  }
  const maxRounds = Math.max(...powers.map((k) => (LEVELS[levelFor(k)] || LEVELS.normal).rounds));
  for (let round = 0; round < maxRounds; round++) {
    const next = {};
    for (const k of powers) {
      const L = LEVELS[levelFor(k)] || LEVELS.normal;
      if (overrides[k] || round >= L.rounds) continue;
      const tot = C[k].list.map(() => 0);
      for (let s = 0; s < L.samples; s++) {
        const others = [];
        for (const q of powers) if (q !== k) { const idx = pickW(C[q].list.map((_, i) => i), pol[q]); for (const o of C[q].list[idx]) others.push(o); }
        C[k].list.forEach((o, i) => { tot[i] += scoreFor(state, k, stance, C[k].vm, adjudicate(state, others.concat(o))); });
      }
      sc[k] = tot.map((x) => x / L.samples);
      next[k] = softmax(sc[k], 0.35);
      if (onProgress) onProgress((round * powers.length + powers.indexOf(k) + 1) / (maxRounds * powers.length));
      await tick();
    }
    Object.assign(pol, next);
  }
  const out = {};
  for (const k of powers) {
    if (overrides[k]) { out[k] = { best: overrides[k], ranked: [{ orders: overrides[k], score: 0 }] }; continue; }
    const L = LEVELS[levelFor(k)] || LEVELS.normal;
    const ranked = C[k].list.map((orders, i) => ({ orders, score: sc[k][i] })).sort((a, b) => b.score - a.score);
    let best = ranked[0].orders;
    if (L.temp > 0.1) { const top = ranked.slice(0, 5); best = pickW(top, softmax(top.map((x) => x.score), L.temp)).orders; }
    out[k] = { best, ranked };
  }
  return out;
}

export function planRetreats(state, k, stance) {
  const vm = valueMaps(state, k, stance), out = {}, taken = new Set();
  for (const p in state.dislodged) {
    const d = state.dislodged[p]; if (d.power !== k) continue;
    const opts = d.options.filter((o) => !taken.has(o)).sort((a, b) => vm[d.type][b] - vm[d.type][a]);
    out[p] = opts[0] || null; if (opts[0]) taken.add(opts[0]);
  }
  return out;
}

export function planBuilds(state, k, stance) {
  const delta = buildDeltas(state)[k], vm = valueMaps(state, k, stance);
  const builds = [], disbands = [];
  if (delta > 0) {
    const mine = unitsOf(state, k); let fleets = mine.filter((p) => state.units[p].type === 'F').length, total = mine.length;
    const sites = buildSites(state, k).sort((a, b) => (vm.reach[b] || 0) - (vm.reach[a] || 0));
    for (const p of sites.slice(0, delta)) {
      let type = 'A';
      if (isCoast(p)) {
        const share = total ? fleets / total : 0;
        const seaWorth = Math.max(...PROV[p].fAdj.map((n) => vm.F[n]));
        const landWorth = Math.max(...PROV[p].aAdj.map((n) => vm.A[n]));
        if (share < 0.3 || (share < 0.45 && seaWorth > landWorth)) type = 'F';
      }
      builds.push({ power: k, p, type }); total++; if (type === 'F') fleets++;
    }
  } else if (delta < 0) {
    const mine = unitsOf(state, k).sort((a, b) => vm[state.units[a].type][a] - vm[state.units[b].type][b]);
    for (const p of mine.slice(0, -delta)) disbands.push({ power: k, p });
  }
  return { builds, disbands };
}

export { alive, convoyReach, HOMES };
