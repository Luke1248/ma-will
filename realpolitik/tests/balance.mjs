// node tests/balance.mjs <map> <level> <games> ['<variant json>']
// Engine self-play balance report. Variant: {"on":["ID"],"off":["ID"],"home":{"ID":k|null},"unit":{"ID":"A"|"F"|null}}
// Prints one JSON line: mean centres per power at the end of year 8, and wins.
import { PROV, NP, POWERS, setMap, recount } from '../js/map.js';
import { newGame, stepOrders, stepRetreats, stepBuilds, scCount } from '../js/rules.js';
import { planAll, planRetreats, planBuilds } from '../js/ai.js';
const [map = 'vietnam', level = 'easy', games = '20', variant = '{}'] = process.argv.slice(2);
setMap(map);
const v = JSON.parse(variant);
for (const id of v.on || []) PROV[id].sc = true;
for (const id of v.off || []) PROV[id].sc = false;
for (const id in v.home || {}) { PROV[id].home = v.home[id]; PROV[id].sc = v.home[id] != null || PROV[id].sc; if (v.home[id] == null) PROV[id].unit = null; }
for (const id in v.unit || {}) PROV[id].unit = v.unit[id];
recount();
const stance = Array.from({ length: NP }, () => Array(NP).fill(-0.2));
const mid = Array(NP).fill(0), wins = Array(NP).fill(0); let none = 0;
for (let g = 0; g < +games; g++) {
  let s = newGame(), took = false;
  while (s.phase !== 'over' && s.year <= 22) {
    if (!took && s.year === 9) { took = true; for (let k = 0; k < NP; k++) mid[k] += scCount(s, k); }
    if (s.phase === 'orders') { const plan = await planAll(s, stance, () => level); s = stepOrders(s, Object.values(plan).flatMap((x) => x.best)).state; }
    else if (s.phase === 'retreats') { const r = {}; for (let k = 0; k < NP; k++) Object.assign(r, planRetreats(s, k, stance)); s = stepRetreats(s, r).state; }
    else { const b = [], d = []; for (let k = 0; k < NP; k++) { const x = planBuilds(s, k, stance); b.push(...x.builds); d.push(...x.disbands); } s = stepBuilds(s, b, d).state; }
  }
  if (!took) for (let k = 0; k < NP; k++) mid[k] += scCount(s, k);
  if (s.winner == null) none++; else wins[s.winner]++;
}
console.log(JSON.stringify({ games: +games, mid: mid.map((x) => +(x / +games).toFixed(2)), wins, none, powers: POWERS.map((p) => p.name) }));
