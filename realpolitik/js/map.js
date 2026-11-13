// Realpolitik — original map.
// A ring continent around an inner sea, with an outer ocean. Seven identical
// sectors (rotational symmetry) so every power starts from an equal position.
// Geometry is a Voronoi diagram of hand-placed seeds, so borders and
// adjacencies are always consistent with what is drawn.

export const W = 1000, H = 1000;
const CX = 500, CY = 500, SCALE = 70, RCLIP = 6.75;
export const NP = 7;

// Per-sector slots: [role, radius, angle (fraction of a sector), kind]
const SLOTS = [
  ['cap',  3.35, 0.10, 'land'], // home capital (inland)
  ['inp',  2.30, 0.00, 'land'], // home inner port
  ['outp', 4.50, 0.02, 'land'], // home outer port
  ['nin',  2.30, 0.50, 'land'], // neutral centre, inner coast
  ['nout', 4.50, 0.68, 'land'], // neutral centre, outer coast
  ['buf',  3.35, 0.60, 'land'], // inland buffer
  ['mar',  4.50, 0.35, 'land'], // outer-coast march
  ['isea', 1.25, 0.50, 'sea'],
  ['osea1', 5.75, 0.20, 'sea'],
  ['osea2', 5.75, 0.70, 'sea'],
];

// [id, name] per sector, in SLOTS order.
const NAMES = [
  [['VAL','Valdris'],['SER','Serenport'],['KES','Kestrel'],['OMB','Ombrey'],['TAR','Tarnhollow'],['GRE','Greywold'],['FEN','Fenwick'],['GLA','Glass Bight'],['GAL','Gale Deep'],['WHA','Whale Road']],
  [['HAL','Halvard'],['ILM','Ilmarsh'],['BRA','Brackmoor'],['QUI','Quillon'],['YAR','Yarrowgate'],['DUN','Dunmere'],['WEX','Wexcombe'],['LAN','Lantern Gulf'],['STO','Storm Sound'],['FRO','Frost Channel']],
  [['MOR','Morvane'],['PEL','Pellucid'],['AST','Asterfell'],['NIM','Nimbray'],['COR','Corrowick'],['THO','Thornby'],['LYS','Lyswater'],['PEA','Pearl Shallows'],['KRA','Kraken Trench'],['SUN','Sunset Main']],
  [['ZAR','Zarethi'],['EBO','Ebonquay'],['RUS','Ruskmoor'],['ULV','Ulvane'],['JAS','Jasperhold'],['SKA','Skarrow'],['VIN','Vintry'],['HUS','Hush Water'],['DRI','Drift Expanse'],['COB','Coral Banks']],
  [['ESK','Eskeral'],['MIR','Mirrowind'],['DRA','Dravenholt'],['OSK','Oskerry'],['GAN','Gannetreach'],['HOL','Hollowmere'],['PLO','Ploverfen'],['AMB','Amber Reach'],['MIS','Mist Passage'],['THU','Thunder Shoals']],
  [['CIN','Cindervale'],['ASH','Ashquay'],['WYR','Wyrmscar'],['BEL','Belmarrow'],['IRO','Ironstrand'],['STA','Starkfield'],['MOS','Mosswater'],['SIR','Siren Narrows'],['ALB','Albatross Run'],['WID','Widow Current']],
  [['LOR','Lorimund'],['TID','Tidewatch'],['NOR','Norrowby'],['EMB','Emberlea'],['SAL','Saltmarsh'],['CRA','Cragmoor'],['ROO','Rookhaven'],['OPA','Opal Bay'],['BEA','Beacon Sea'],['LON','Longnight Ocean']],
];

export const DEFAULT_POWERS = [
  { name: 'Valdris',    color: '#c0392b', logo: '🦅' },
  { name: 'Halvard',    color: '#2471a3', logo: '🐺' },
  { name: 'Morvane',    color: '#1e8449', logo: '🦌' },
  { name: 'Zarethi',    color: '#b7950b', logo: '🐍' },
  { name: 'Eskeral',    color: '#7d3c98', logo: '🦉' },
  { name: 'Cindervale', color: '#d35400', logo: '🔥' },
  { name: 'Lorimund',   color: '#17a2a2', logo: '⚓' },
];

function build() {
  const P = {}; const order = [];
  const add = (id, name, kind, x, y, extra = {}) => {
    P[id] = { id, name, kind, x, y, sc: false, home: null, adj: [], aAdj: [], fAdj: [], poly: [], ...extra };
    order.push(id);
  };
  add('MAW', 'The Maw', 'sea', CX, CY);
  for (let k = 0; k < NP; k++) {
    SLOTS.forEach(([role, r, a, kind], i) => {
      const th = (k + a) * (2 * Math.PI / NP) - Math.PI / 2;
      const [id, name] = NAMES[k][i];
      const extra = { role, sector: k };
      if (role === 'cap' || role === 'inp' || role === 'outp') { extra.sc = true; extra.home = k; }
      if (role === 'nin' || role === 'nout') extra.sc = true;
      add(id, name, kind, CX + SCALE * r * Math.cos(th), CY + SCALE * r * Math.sin(th), extra);
    });
  }
  // Voronoi by half-plane clipping against a circular boundary.
  const N = 72, bound = [];
  for (let i = 0; i < N; i++) {
    const t = i / N * 2 * Math.PI;
    bound.push([CX + SCALE * RCLIP * Math.cos(t), CY + SCALE * RCLIP * Math.sin(t)]);
  }
  const clip = (poly, a, b) => { // keep points closer to a than b
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = b.x - a.x, ny = b.y - a.y;
    const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny; // <=0 keep
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
      if (sp <= 0) out.push(p);
      if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  };
  for (const id of order) {
    let poly = bound;
    for (const o of order) if (o !== id) poly = clip(poly, P[id], P[o]);
    P[id].poly = poly;
  }
  // Adjacency: shared edge longer than MIN px.
  const MIN = 12, EPS = 0.5;
  const d = (p, s) => Math.hypot(p[0] - s.x, p[1] - s.y);
  const edges = {}; // "A|B" -> [p,q]
  for (const id of order) {
    const poly = P[id].poly;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) < MIN) continue;
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], di = d(m, P[id]);
      for (const o of order) {
        if (o === id) continue;
        if (Math.abs(d(m, P[o]) - di) < EPS) {
          if (!P[id].adj.includes(o)) P[id].adj.push(o);
          edges[[id, o].sort().join('|')] = [p, q];
        }
      }
    }
  }
  const seaTouches = (pt) => order.some((o) => P[o].kind === 'sea' && P[o].poly.some((v) => Math.hypot(v[0] - pt[0], v[1] - pt[1]) < 1));
  for (const id of order) {
    const a = P[id];
    if (a.kind === 'land') a.coastal = a.adj.some((o) => P[o].kind === 'sea');
    for (const o of a.adj) {
      const b = P[o];
      if (a.kind === 'land' && b.kind === 'land') {
        a.aAdj.push(o);
        const e = edges[[id, o].sort().join('|')];
        if (e && (seaTouches(e[0]) || seaTouches(e[1]))) a.fAdj.push(o);
      } else {
        a.fAdj.push(o); // sea-sea, sea-coast
      }
    }
  }
  return { P, order };
}

const built = build();
export const PROV = built.P;
export const IDS = built.order;
export const SCS = IDS.filter((id) => PROV[id].sc);
export const HOMES = Array.from({ length: NP }, (_, k) => IDS.filter((id) => PROV[id].home === k));
export const WIN_SCS = Math.floor(SCS.length / 2) + 1;

export const adjFor = (type, id) => (type === 'A' ? PROV[id].aAdj : PROV[id].fAdj);
export const isSea = (id) => PROV[id].kind === 'sea';
export const isCoast = (id) => PROV[id].kind === 'land' && PROV[id].coastal;

// Starting units: army in the capital, fleet in the inner port, army in the outer port.
export function startingUnits() {
  const u = {};
  for (const id of IDS) {
    const p = PROV[id];
    if (p.home == null) continue;
    u[id] = { power: p.home, type: p.role === 'inp' ? 'F' : 'A' };
  }
  return u;
}
