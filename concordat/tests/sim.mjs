// node tests/sim.mjs [games] [level] — AI self-play smoke test.
import { NP } from '../js/map.js';
import { newGame, stepOrders, stepRetreats, stepBuilds, scCount, isValid } from '../js/rules.js';
import { planAll, planRetreats, planBuilds } from '../js/ai.js';

const games = +process.argv[2] || 2, level = process.argv[3] || 'normal';
const stance = Array.from({ length: NP }, () => Array(NP).fill(-0.2));
for (let g = 0; g < games; g++) {
  let s = newGame(); const t0 = Date.now(); let phases = 0, invalid = 0, ms = 0;
  while (s.phase !== 'over' && s.year <= 30) {
    if (s.phase === 'orders') {
      const t = Date.now();
      const plan = await planAll(s, stance, () => level);
      ms += Date.now() - t; phases++;
      const all = []; for (const k in plan) for (const o of plan[k].best) { if (!isValid(s, o)) invalid++; all.push(o); }
      s = stepOrders(s, all).state;
    } else if (s.phase === 'retreats') {
      const r = {}; for (let k = 0; k < NP; k++) Object.assign(r, planRetreats(s, k, stance));
      s = stepRetreats(s, r).state;
    } else if (s.phase === 'builds') {
      const b = [], d = []; for (let k = 0; k < NP; k++) { const x = planBuilds(s, k, stance); b.push(...x.builds); d.push(...x.disbands); }
      s = stepBuilds(s, b, d).state;
    }
  }
  const scs = Array.from({ length: NP }, (_, k) => scCount(s, k));
  console.log(`game ${g + 1}: ended year ${s.year} winner=${s.winner} scs=${scs.join(',')} units=${Object.keys(s.units).length} invalid=${invalid} avg plan ${(ms / phases).toFixed(0)}ms total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
