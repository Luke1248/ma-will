// Realpolitik — original map.
// A ring continent around an inner sea, with an outer ocean. Seven identical
// sectors (rotational symmetry) so every power starts from an equal position.
// Geometry is a Voronoi diagram of hand-placed seeds, so borders and
// adjacencies are always consistent with what is drawn.

export const W = 1000, H = 1000;
const CX = 500, CY = 500, SCALE = 70, RCLIP = 6.75;

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


// ---- Generic geometry ------------------------------------------------------
// seeds: [{id, name, kind, x, y, ...flags}] ; bound: clip polygon.
function voronoi(seeds, bound) {
  const P = {}, order = [];
  for (const s of seeds) { P[s.id] = { sc: false, home: null, cap: false, unit: null, ...s, adj: [], aAdj: [], fAdj: [], poly: [] }; order.push(s.id); }
  const clip = (poly, a, b) => { // keep points closer to a than b
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = b.x - a.x, ny = b.y - a.y;
    const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
      if (sp <= 0) out.push(p);
      if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
    return out;
  };
  for (const id of order) { let poly = bound; for (const o of order) if (o !== id) poly = clip(poly, P[id], P[o]); P[id].poly = poly; }
  const MIN = 12, EPS = 0.5, d = (p, s) => Math.hypot(p[0] - s.x, p[1] - s.y), edges = {};
  for (const id of order) {
    const poly = P[id].poly;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) < MIN) continue;
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], di = d(m, P[id]);
      for (const o of order) {
        if (o === id) continue;
        if (Math.abs(d(m, P[o]) - di) < EPS) { if (!P[id].adj.includes(o)) P[id].adj.push(o); edges[[id, o].sort().join('|')] = [p, q]; }
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
      } else a.fAdj.push(o);
    }
  }
  return { P, order };
}

// ---- Map 1: the Ring -------------------------------------------------------
function ringSeeds() {
  const seeds = [{ id: 'MAW', name: 'The Maw', kind: 'sea', x: CX, y: CY }];
  for (let k = 0; k < 7; k++) SLOTS.forEach(([role, r, a, kind], i) => {
    const th = (k + a) * (2 * Math.PI / 7) - Math.PI / 2, [id, name] = NAMES[k][i];
    const s = { id, name, kind, x: CX + SCALE * r * Math.cos(th), y: CY + SCALE * r * Math.sin(th), role, sector: k };
    if (role === 'cap' || role === 'inp' || role === 'outp') { s.sc = true; s.home = k; s.unit = role === 'inp' ? 'F' : 'A'; s.cap = role === 'cap'; }
    if (role === 'nin' || role === 'nout') s.sc = true;
    seeds.push(s);
  });
  const bound = [];
  for (let i = 0; i < 72; i++) { const t = i / 72 * 2 * Math.PI; bound.push([CX + SCALE * RCLIP * Math.cos(t), CY + SCALE * RCLIP * Math.sin(t)]); }
  return { seeds, bound };
}

// ---- Map 2: Indochina, 1965 -------------------------------------------------
// Schematic map of mainland Southeast Asia in the Vietnam War era. Seeds are
// real places at (longitude, latitude); borders are Voronoi cells, so coasts
// are stylised and the open sea east of Vietnam is compressed. Flags: sc = supply centre, h = home power, u = starting unit,
// c = capital.
const VN_POWERS = [
  { name: 'North Vietnam', color: '#c0392b', logo: '⭐' },
  { name: 'South Vietnam', color: '#c9a20a', logo: '🐯' },
  { name: 'United States', color: '#2471a3', logo: '🦅' },
  { name: 'Laos',          color: '#7d3c98', logo: '🐘' },
  { name: 'Cambodia',      color: '#d35400', logo: '🛕' },
  { name: 'Thailand',      color: '#17a2a2', logo: '👑' },
  { name: 'China',         color: '#1e8449', logo: '🐉' },
];
const L = 'land', S = 'sea';
const VN = [
  // North Vietnam
  ['HAN', 'Hanoi', L, 105.8, 21.0, { h: 0, u: 'A', c: 1 }], ['HPH', 'Haiphong', L, 107.1, 20.7, { h: 0, u: 'F' }], ['VIN', 'Vinh', L, 105.6, 18.7, { h: 0, u: 'A' }],
  ['DBP', 'Dien Bien Phu', L, 103.0, 21.4, { sc: 1 }], ['LCA', 'Lao Cai', L, 104.4, 22.4], ['LSN', 'Lang Son', L, 106.7, 22.1], ['THA', 'Thanh Hoa', L, 105.6, 19.9, { sc: 1 }], ['DHO', 'Dong Hoi', L, 106.4, 17.6, { sc: 1 }],
  // South Vietnam and US bases
  ['SGN', 'Saigon', L, 106.7, 10.8, { h: 1, u: 'A', c: 1 }], ['HUE', 'Hue', L, 107.5, 16.5, { h: 1, u: 'A' }], ['CTH', 'Can Tho', L, 105.6, 9.8, { h: 1, u: 'F' }],
  ['DNG', 'Da Nang', L, 108.4, 15.5, { h: 2, u: 'A' }], ['CRB', 'Cam Ranh Bay', L, 109.1, 12.0, { h: 2, u: 'F' }], ['SUB', 'Subic Bay', L, 116.1, 14.6, { h: 2, u: 'F', c: 1 }],
  ['PLK', 'Pleiku', L, 107.9, 14.0, { h: 1, u: 'A' }], ['QNH', 'Qui Nhon', L, 109.1, 13.8], ['BMT', 'Ban Me Thuot', L, 108.1, 12.7], ['PTH', 'Phan Thiet', L, 108.1, 11.0],
  ['TNH', 'Tay Ninh', L, 105.9, 11.8], ['CMU', 'Ca Mau', L, 105.0, 8.9, { sc: 1 }],
  // Laos
  ['VTE', 'Vientiane', L, 102.6, 18.1, { h: 3, u: 'A', c: 1 }], ['LPB', 'Luang Prabang', L, 102.1, 19.9, { h: 3, u: 'A' }], ['PKS', 'Pakse', L, 105.8, 15.1, { h: 3, u: 'A' }],
  ['PDJ', 'Plain of Jars', L, 103.5, 19.4, { h: 3, u: 'A' }], ['SAV', 'Savannakhet', L, 105.0, 16.6, { sc: 1 }], ['TCH', 'Tchepone', L, 106.3, 16.3], ['PSL', 'Phongsali', L, 101.8, 21.9], ['TKK', 'Thakhek', L, 104.7, 17.7], ['ATP', 'Attapeu', L, 107.0, 14.9, { sc: 1 }],
  // Cambodia
  ['PNH', 'Phnom Penh', L, 104.8, 11.5, { h: 4, u: 'A', c: 1 }], ['BTB', 'Battambang', L, 103.1, 13.0, { h: 4, u: 'A' }], ['KPS', 'Kompong Som', L, 103.6, 10.7, { h: 4, u: 'F' }],
  ['ANG', 'Angkor', L, 104.2, 13.9], ['KTM', 'Kompong Thom', L, 104.9, 12.7], ['STG', 'Stung Treng', L, 106.0, 13.6], ['MDK', 'Mondulkiri', L, 106.9, 12.7],
  // Thailand and the Burmese border
  ['BKK', 'Bangkok', L, 100.5, 13.8, { h: 5, u: 'F', c: 1 }], ['UDN', 'Udon Thani', L, 102.8, 16.9, { h: 5, u: 'A' }], ['CNX', 'Chiang Mai', L, 99.0, 18.8, { h: 5, u: 'A' }],
  ['KOR', 'Korat', L, 102.1, 15.0], ['UBN', 'Ubon', L, 104.6, 15.3, { sc: 1 }], ['PHL', 'Phitsanulok', L, 100.4, 16.8], ['NAN', 'Nan', L, 100.8, 18.9], ['CHB', 'Chanthaburi', L, 102.1, 12.6],
  ['HHN', 'Hua Hin', L, 99.7, 11.9], ['KRA', 'Kra Isthmus', L, 99.3, 9.6, { sc: 1 }], ['KAN', 'Kanchanaburi', L, 99.1, 14.8, { sc: 1 }], ['KTG', 'Kengtung', L, 99.6, 21.3, { sc: 1 }], ['MLM', 'Moulmein', L, 98.1, 16.6, { sc: 1 }], ['TVY', 'Tavoy', L, 98.3, 13.2], ['LSH', 'Lashio', L, 98.4, 23.2],
  // China
  ['KMG', 'Kunming', L, 102.7, 25.0, { h: 6, u: 'A', c: 1 }], ['NNG', 'Nanning', L, 108.3, 22.8, { h: 6, u: 'A' }], ['HKO', 'Hainan', L, 109.9, 19.3, { h: 6, u: 'F' }],
  ['SMO', 'Simao', L, 100.9, 23.0], ['MZI', 'Mengzi', L, 103.5, 23.4], ['BSE', 'Baise', L, 105.9, 23.9], ['DLI', 'Dali', L, 100.2, 25.7], ['GYG', 'Guiyang', L, 106.3, 25.7], ['GLN', 'Guilin', L, 110.2, 25.2],
  ['ZHJ', 'Zhanjiang', L, 110.4, 21.3], ['GZH', 'Guangzhou', L, 113.0, 23.6], ['HKG', 'Hong Kong', L, 114.3, 22.3], ['SGU', 'Shaoguan', L, 113.6, 25.3], ['STU', 'Shantou', L, 116.0, 23.6],
  // Seas
  ['GTK', 'Gulf of Tonkin', S, 107.7, 19.3], ['YKS', 'Yankee Station', S, 109.0, 17.3], ['PRC', 'Paracel Sea', S, 112.2, 16.6], ['PRL', 'Pearl Estuary', S, 113.4, 20.4], ['PRT', 'Pratas Sea', S, 115.7, 20.4],
  ['MCB', 'Macclesfield Bank', S, 113.8, 16.6], ['WLS', 'West Luzon Sea', S, 114.1, 12.9], ['CCW', 'Central Coast', S, 110.9, 13.4],
  ['DXS', 'Dixie Station', S, 109.6, 10.0], ['SPR', 'Spratly Sea', S, 113.4, 10.0], ['LZS', 'Luzon Sea', S, 116.2, 17.9], ['PLW', 'Palawan Passage', S, 116.2, 11.3], ['CSN', 'Con Son Waters', S, 107.4, 9.2],
  ['NTN', 'Natuna Sea', S, 110.4, 8.2], ['SGF', 'South Gulf', S, 103.0, 8.0], ['GTH', 'Gulf of Thailand', S, 101.8, 10.3], ['BBK', 'Bight of Bangkok', S, 100.9, 12.3], ['RGS', 'Rach Gia Sound', S, 104.2, 9.6],
];
function vietnamSeeds() {
  const X0 = 97.4, X1 = 117.0, Y0 = 7.6, Y1 = 26.2, sx = W / (X1 - X0), sy = sx / Math.cos(17 * Math.PI / 180), top = (H - (Y1 - Y0) * sy) / 2;
  const seeds = VN.map(([id, name, kind, lon, lat, f = {}]) => ({ id, name, kind, x: (lon - X0) * sx, y: top + (Y1 - lat) * sy, sc: !!(f.sc || f.h != null), home: f.h ?? null, unit: f.u || null, cap: !!f.c }));
  const bot = top + (Y1 - Y0) * sy;
  return { seeds, bound: [[0, top], [W, top], [W, bot], [0, bot]] };
}

export const MAPS = {
  ring: { id: 'ring', name: 'The Ring', blurb: 'a ring-shaped continent around an inner sea, with an outer ocean (the two seas do not connect); seven identical starting positions', powers: DEFAULT_POWERS, make: ringSeeds },
  vietnam: { id: 'vietnam', name: 'Indochina 1965', blurb: 'mainland Southeast Asia in the Vietnam War era, from Yunnan to the Mekong Delta and with the South China Sea compressed so that Subic Bay sits at its eastern edge; starting positions are historical; South Vietnam and Laos, hemmed in on all sides, begin with a fourth home centre', powers: VN_POWERS, make: vietnamSeeds },
};

// Live bindings: every module sees the active map after setMap().
export let MAP_ID, PROV, IDS, SCS, HOMES, NP, WIN_SCS, POWERS, NEIGHBORS, MAP;
const cache = {};
export function setMap(id) {
  const def = MAPS[id] || MAPS.ring;
  if (!cache[def.id]) { const { seeds, bound } = def.make(); cache[def.id] = voronoi(seeds, bound); }
  MAP = def; MAP_ID = def.id; PROV = cache[def.id].P; IDS = cache[def.id].order; POWERS = def.powers; NP = def.powers.length;
  SCS = IDS.filter((p) => PROV[p].sc);
  HOMES = Array.from({ length: NP }, (_, k) => IDS.filter((p) => PROV[p].home === k));
  WIN_SCS = Math.floor(SCS.length / 2) + 1;
  // Two nearest rival powers, by distance between home centres.
  const dist = (k) => { const seen = {}, q = []; for (const h of HOMES[k]) { seen[h] = 0; q.push(h); } while (q.length) { const c = q.shift(); for (const n of PROV[c].adj) if (!(n in seen)) { seen[n] = seen[c] + 1; q.push(n); } } return seen; };
  NEIGHBORS = Array.from({ length: NP }, (_, k) => { const d = dist(k); return [...Array(NP).keys()].filter((q) => q !== k).sort((a, b) => Math.min(...HOMES[a].map((h) => d[h] ?? 99)) - Math.min(...HOMES[b].map((h) => d[h] ?? 99))).slice(0, 2); });
  return def;
}
setMap('ring');

// Recompute derived tables after editing province flags (used by tests/balance.mjs).
export function recount() {
  SCS = IDS.filter((p) => PROV[p].sc);
  HOMES = Array.from({ length: NP }, (_, k) => IDS.filter((p) => PROV[p].home === k));
  WIN_SCS = Math.floor(SCS.length / 2) + 1;
}

export const adjFor = (type, id) => (type === 'A' ? PROV[id].aAdj : PROV[id].fAdj);
export const isSea = (id) => PROV[id].kind === 'sea';
export const isCoast = (id) => PROV[id].kind === 'land' && PROV[id].coastal;

export function startingUnits() {
  const u = {};
  for (const id of IDS) if (PROV[id].unit) u[id] = { power: PROV[id].home, type: PROV[id].unit };
  return u;
}
