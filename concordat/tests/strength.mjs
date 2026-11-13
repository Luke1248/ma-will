// node tests/strength.mjs [games] — one Hard engine power against six Easy ones.
import { NP } from '../js/map.js';
import { newGame, stepOrders, stepRetreats, stepBuilds, scCount } from '../js/rules.js';
import { planAll, planRetreats, planBuilds } from '../js/ai.js';
const games = +process.argv[2] || 14, stance = Array.from({ length: NP }, () => Array(NP).fill(-0.2));
let wins = 0, scHard = 0, scEasy = 0;
for (let g = 0; g < games; g++) {
  const hard = g % NP; let s = newGame();
  while (s.phase !== 'over' && s.year <= 25) {
    if (s.phase === 'orders') { const plan = await planAll(s, stance, (k) => (k === hard ? 'hard' : 'easy')); s = stepOrders(s, Object.values(plan).flatMap((x) => x.best)).state; }
    else if (s.phase === 'retreats') { const r = {}; for (let k = 0; k < NP; k++) Object.assign(r, planRetreats(s, k, stance)); s = stepRetreats(s, r).state; }
    else { const b = [], d = []; for (let k = 0; k < NP; k++) { const x = planBuilds(s, k, stance); b.push(...x.builds); d.push(...x.disbands); } s = stepBuilds(s, b, d).state; }
  }
  if (s.winner === hard) wins++;
  scHard += scCount(s, hard); for (let k = 0; k < NP; k++) if (k !== hard) scEasy += scCount(s, k) / (NP - 1);
}
console.log(`Hard vs 6 Easy over ${games} games: wins ${wins}/${games} (chance = ${(games / NP).toFixed(1)}), avg final centres hard ${(scHard / games).toFixed(1)} vs easy ${(scEasy / games).toFixed(1)}`);
