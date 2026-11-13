// node tests/rules.test.mjs
import assert from 'node:assert/strict';
import { PROV, IDS, SCS, HOMES, NP, WIN_SCS, setMap } from '../js/map.js';
import { adjudicate, newGame, stepOrders, stepRetreats, stepBuilds, parseOrder, isValid } from '../js/rules.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const S = (units) => ({ ...newGame(), units });
const A = (power) => ({ power, type: 'A' }), F = (power) => ({ power, type: 'F' });
const ok = (r, p) => r.results[p].ok;

t('map sanity', () => {
  assert.equal(new Set(IDS).size, 71);
  for (const id of IDS) for (const o of PROV[id].adj) assert(PROV[o].adj.includes(id));
  assert(PROV.VAL.aAdj.includes('GRE') && PROV.SER.fAdj.includes('GLA') && !PROV.VAL.coastal);
});
t('simple move and bounce', () => {
  let r = adjudicate(S({ VAL: A(0) }), [{ p: 'VAL', t: 'M', to: 'GRE' }]);
  assert(ok(r, 'VAL') && r.newUnits.GRE);
  r = adjudicate(S({ VAL: A(0), HAL: A(1) }), [{ p: 'VAL', t: 'M', to: 'GRE' }, { p: 'HAL', t: 'M', to: 'GRE' }]);
  assert(!ok(r, 'VAL') && !ok(r, 'HAL') && r.contested.includes('GRE'));
});
t('supported attack dislodges; retreat options exclude attacker origin', () => {
  const r = adjudicate(S({ VAL: A(0), OMB: A(0), GRE: A(1) }), [{ p: 'VAL', t: 'M', to: 'GRE' }, { p: 'OMB', t: 'S', from: 'VAL', to: 'GRE' }]);
  assert(ok(r, 'VAL') && r.dislodged.GRE && !r.dislodged.GRE.options.includes('VAL'));
});
t('support is cut by attack from elsewhere, not from the target', () => {
  let r = adjudicate(S({ VAL: A(0), OMB: A(0), GRE: A(1), ILM: A(1) }), [
    { p: 'VAL', t: 'M', to: 'GRE' }, { p: 'OMB', t: 'S', from: 'VAL', to: 'GRE' }, { p: 'ILM', t: 'M', to: 'OMB' }]);
  assert(!ok(r, 'OMB') && !ok(r, 'VAL'));
  r = adjudicate(S({ VAL: A(0), OMB: A(0), GRE: A(1) }), [
    { p: 'VAL', t: 'M', to: 'GRE' }, { p: 'OMB', t: 'S', from: 'VAL', to: 'GRE' }, { p: 'GRE', t: 'M', to: 'OMB' }]);
  assert(ok(r, 'OMB') && ok(r, 'VAL'));
});
t('support hold defends', () => {
  const r = adjudicate(S({ VAL: A(0), OMB: A(0), GRE: A(1), HAL: A(1) }), [
    { p: 'VAL', t: 'M', to: 'GRE' }, { p: 'OMB', t: 'S', from: 'VAL', to: 'GRE' }, { p: 'HAL', t: 'S', from: 'GRE', to: 'GRE' }]);
  assert(!ok(r, 'VAL') && !r.dislodged.GRE);
});
t('no self-dislodgement, no swapping places', () => {
  let r = adjudicate(S({ VAL: A(0), OMB: A(0), GRE: A(0) }), [{ p: 'VAL', t: 'M', to: 'GRE' }, { p: 'OMB', t: 'S', from: 'VAL', to: 'GRE' }]);
  assert(!ok(r, 'VAL'));
  r = adjudicate(S({ VAL: A(0), GRE: A(1) }), [{ p: 'VAL', t: 'M', to: 'GRE' }, { p: 'GRE', t: 'M', to: 'VAL' }]);
  assert(!ok(r, 'VAL') && !ok(r, 'GRE'));
});
t('head-to-head: stronger side wins', () => {
  const r = adjudicate(S({ VAL: A(0), OMB: A(0), GRE: A(1) }), [
    { p: 'VAL', t: 'M', to: 'GRE' }, { p: 'OMB', t: 'S', from: 'VAL', to: 'GRE' }, { p: 'GRE', t: 'M', to: 'VAL' }]);
  assert(ok(r, 'VAL') && !ok(r, 'GRE') && r.dislodged.GRE);
});
t('circular movement succeeds', () => {
  const r = adjudicate(S({ VAL: A(0), GRE: A(0), OMB: A(0) }), [
    { p: 'VAL', t: 'M', to: 'GRE' }, { p: 'GRE', t: 'M', to: 'OMB' }, { p: 'OMB', t: 'M', to: 'VAL' }]);
  assert(ok(r, 'VAL') && ok(r, 'GRE') && ok(r, 'OMB'));
});
t('follow-through into vacated province', () => {
  const r = adjudicate(S({ VAL: A(0), GRE: A(1) }), [{ p: 'VAL', t: 'M', to: 'GRE' }, { p: 'GRE', t: 'M', to: 'HAL' }]);
  assert(ok(r, 'VAL') && ok(r, 'GRE'));
});
t('convoy works and is disrupted by dislodging the fleet', () => {
  const st = S({ SER: A(0), GLA: F(0), LAN: F(1), OPA: F(1) });
  const o = [{ p: 'SER', t: 'M', to: 'ILM' }, { p: 'GLA', t: 'C', from: 'SER', to: 'ILM' }];
  assert(isValid(st, o[0]));
  let r = adjudicate(st, o);
  assert(ok(r, 'SER') && r.newUnits.ILM.type === 'A');
  r = adjudicate(st, [...o, { p: 'LAN', t: 'M', to: 'GLA' }, { p: 'OPA', t: 'S', from: 'LAN', to: 'GLA' }]);
  assert(!ok(r, 'SER') && r.dislodged.GLA);
});
t('fleets cannot go inland; armies cannot go to sea', () => {
  assert(!isValid(S({ SER: F(0) }), { p: 'SER', t: 'M', to: 'VAL' }));
  assert(!isValid(S({ SER: A(0) }), { p: 'SER', t: 'M', to: 'GLA' }));
});
t('parse orders', () => {
  assert.deepEqual(parseOrder('A VAL - GRE'), { p: 'VAL', t: 'M', to: 'GRE' });
  assert.deepEqual(parseOrder('F SER S A VAL-GRE'), { p: 'SER', t: 'S', from: 'VAL', to: 'GRE' });
  assert.deepEqual(parseOrder('F GLA C A SER - ILM'), { p: 'GLA', t: 'C', from: 'SER', to: 'ILM' });
  assert.deepEqual(parseOrder('A VAL S A GRE'), { p: 'VAL', t: 'S', from: 'GRE', to: 'GRE' });
});
t('turn cycle: capture, build, retreat', () => {
  let s = newGame();
  ({ state: s } = stepOrders(s, [{ p: 'SER', t: 'M', to: 'OMB' }]));
  assert(s.season === 'fall' && s.units.OMB);
  ({ state: s } = stepOrders(s, []));
  assert.equal(s.phase, 'builds'); assert.equal(s.owners.OMB, 0);
  ({ state: s } = stepBuilds(s, [{ power: 0, p: 'SER', type: 'F' }], []));
  assert(s.units.SER.type === 'F' && s.year === 2 && s.phase === 'orders');
  let d = S({ VAL: A(0), OMB: A(0), GRE: A(1) });
  ({ state: d } = stepOrders(d, [{ p: 'VAL', t: 'M', to: 'GRE' }, { p: 'OMB', t: 'S', from: 'VAL', to: 'GRE' }]));
  assert.equal(d.phase, 'retreats');
  ({ state: d } = stepRetreats(d, { GRE: 'HAL' }));
  assert(d.units.HAL.power === 1 && d.phase === 'orders');
});
t('Indochina map loads and is consistent', () => {
  setMap('vietnam');
  assert.equal(NP, 7); assert.equal(SCS.length, 34); assert.equal(WIN_SCS, 18);
  for (const id of IDS) { assert(PROV[id].adj.length >= 2, id); for (const o of PROV[id].adj) assert(PROV[o].adj.includes(id)); }
  for (const h of HOMES) assert.equal(h.length, 3);
  for (const id of IDS) if (PROV[id].unit === 'F') assert(PROV[id].coastal, id);
  const s = newGame(); assert.equal(Object.keys(s.units).length, 21);
  assert(isValid(s, { p: 'HPH', t: 'M', to: 'GTK' }) && !isValid(s, { p: 'HAN', t: 'M', to: 'GTK' }));
  setMap('ring');
});
console.log(`${n} tests passed`);
