// Concordat UI — single-page, touch-first.
import { PROV, IDS, SCS, NP, W, H, DEFAULT_POWERS, adjFor, isSea, isCoast } from './map.js';
import { moveTargets, isValid, fmtOrder, scCount, unitsOf, alive, buildDeltas, buildSites, WIN_SCS } from './rules.js';
import * as GM from './game.js';
import { PRESETS, loadProfiles, saveProfiles, listModels, testProfile } from './llm.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
let G = null;
const ui = { screen: 'home', setup: null, edit: null, cur: null, queue: [], curtain: false, tab: 'orders', sel: null, mode: null, supFrom: null,
  drafts: {}, submitted: {}, retreats: {}, builds: {}, disb: {}, report: null, chatWith: null, chatDraft: '', typing: {}, busy: null, dip: null, vb: { x: 0, y: 0, w: W, h: H } };

function toast(msg, ms = 4500) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms); }
const logo = (p, cls = '') => `<span class="logo ${cls}" style="background:${esc(p.color)}">${String(p.logo).startsWith('data:') ? `<img src="${esc(p.logo)}" alt="">` : esc(p.logo)}</span>`;
const ctrlLabel = (c) => { if (c === 'human') return 'Human'; if (c === 'engine') return 'Engine'; const pr = loadProfiles().find((p) => 'llm:' + p.id === c); return pr ? `LLM · ${pr.label}` : 'LLM (missing)'; };

// ------------------------------------------------------------------ screens
function render() {
  if (ui.screen === 'home') return renderHome();
  if (ui.screen === 'setup') return renderSetup();
  if (ui.screen === 'models') return renderModels();
  if (ui.screen === 'help') return renderHelp();
  if (ui.screen === 'game') return renderGame();
}

function renderHome() {
  const saved = GM.loadGame();
  app.innerHTML = `<div class="page"><div class="home">
    <div style="text-align:center;margin-bottom:10px"><h1>CONCORDAT</h1><p class="dim">Seven powers. One ring of land. No binding promises.</p></div>
    ${saved && saved.state ? `<button class="primary" data-act="continue">Continue — ${esc(GM.seasonName(saved.state))}</button>` : ''}
    <button ${saved ? '' : 'class="primary"'} data-act="new">New game</button>
    <button data-act="models">AI models</button>
    <button data-act="help">How to play</button>
    <p class="dim small" style="text-align:center">Add to Home Screen from Safari's share menu to install.</p>
  </div></div>`;
}

function renderHelp() {
  app.innerHTML = `<div class="page stack"><div class="row"><button data-act="home">‹ Back</button><h2 style="margin:0">How to play</h2></div>
  <div class="card"><p><b>Goal.</b> Control ${WIN_SCS} of the 35 supply centres (★). You field one unit per centre you own.</p>
  <p><b>Units.</b> Armies (square) move on land. Fleets (circle) move on seas and along coasts. The Inner Sea and the Outer Ocean do not connect. One unit per province; every unit has strength 1.</p>
  <p><b>Orders.</b> Everyone's orders are secret and resolve at once. Tap a unit, then a highlighted province to move. Tap it again to hold. <i>Support</i> adds 1 strength to another unit's move or hold; it is cut if the supporter is attacked from anywhere except the province it is supporting into. <i>Convoy</i>: a fleet at sea carries an army between coasts.</p>
  <p><b>Conflicts.</b> The strongest move wins; ties bounce. A beaten unit must retreat to a free neighbouring province or disband.</p>
  <p><b>Years.</b> Spring and Fall moves. After Fall, whoever occupies a centre owns it; then you build in your own empty home centres, or disband down to your centre count.</p>
  <p><b>Diplomacy.</b> Talk before you order. Nothing is binding. Engine powers answer formal proposals (peace, alliance). Powers run by an LLM negotiate in free text and remember what you did.</p>
  <p><b>Pass-and-play.</b> With several humans, the device hides each player's orders and messages behind a hand-over screen.</p></div></div>`;
}

function ctrlOptions(cur) {
  const o = [['human', 'Human'], ['engine:easy', 'Engine · Easy'], ['engine:normal', 'Engine · Normal'], ['engine:hard', 'Engine · Hard']];
  for (const p of loadProfiles()) o.push(['llm:' + p.id, `LLM · ${p.label} (${p.model || 'no model'})`]);
  return o.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
}
function renderSetup() {
  const s = ui.setup;
  app.innerHTML = `<div class="page stack"><div class="row"><button data-act="home">‹ Back</button><h2 style="margin:0">New game</h2></div>
  <p class="dim small">Name each power, pick its colour and emblem (type an emoji, or tap the emblem to upload an image), and choose who plays it.</p>
  ${s.powers.map((p, i) => `<div class="card"><div class="setup-row">
      <input class="swatch" type="color" value="${esc(p.color)}" data-chg="pcolor" data-i="${i}">
      <span data-act="plogo" data-i="${i}">${logo(p)}</span>
      <div class="row"><input type="text" class="logo-in" style="width:52px;flex:none" maxlength="4" value="${String(p.logo).startsWith('data:') ? '' : esc(p.logo)}" placeholder="🖼" data-chg="plogotxt" data-i="${i}">
      <input type="text" class="grow" maxlength="24" value="${esc(p.name)}" data-chg="pname" data-i="${i}"></div>
      <select data-chg="pctrl" data-i="${i}">${ctrlOptions(p.sel)}</select></div></div>`).join('')}
  <div class="card"><h3 style="margin-top:0">LLM powers</h3>
    <label>Negotiation rounds between LLM powers each season</label>
    <select data-chg="neg">${[0, 1, 2, 3].map((n) => `<option ${n === s.negRounds ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label><input type="checkbox" data-chg="llmorders" ${s.llmOrders ? 'checked' : ''}> LLM makes the final choice of orders (one extra call per power per season)</label>
    <p class="dim small">No models configured? <a href="#" data-act="models" style="color:var(--accent)">Add one</a>. Engine powers need no network.</p></div>
  <input type="file" id="logofile" accept="image/*" hidden>
  <button class="primary" data-act="start" style="width:100%;padding:14px">Start game</button></div>`;
}

function renderModels() {
  const profs = loadProfiles(), e = ui.edit;
  app.innerHTML = `<div class="page stack"><div class="row"><button data-act="${ui.setup ? 'backsetup' : 'home'}">‹ Back</button><h2 style="margin:0">AI models</h2></div>
  <p class="dim small">A profile is an endpoint plus a model. Any power can be assigned any profile, so different powers can run different models. Keys stay on this device and go only to the endpoint you enter.</p>
  ${profs.map((p) => `<div class="card row"><div class="grow"><b>${esc(p.label)}</b><div class="dim small mono">${esc(p.model || '(no model)')} · ${esc(p.baseUrl)}</div></div><button class="sm" data-act="editprof" data-id="${p.id}">Edit</button></div>`).join('') || '<p class="dim">No profiles yet.</p>'}
  ${e ? `<div class="card"><h3 style="margin-top:0">${e.isNew ? 'New profile' : 'Edit profile'}</h3>
    <label>Provider</label><select data-chg="epreset">${PRESETS.map((p) => `<option value="${p.id}" ${p.id === e.preset ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
    <label>Label</label><input type="text" value="${esc(e.label)}" data-chg="elabel">
    <label>Base URL</label><input type="url" value="${esc(e.baseUrl)}" data-chg="ebase" autocapitalize="off" autocorrect="off" spellcheck="false">
    <label>API key ${e.kind === 'openai' ? '(leave empty for local servers)' : ''}</label><input type="password" value="${esc(e.apiKey)}" data-chg="ekey" autocomplete="off">
    <label>Model</label><div class="row"><input type="text" class="grow" list="modellist" value="${esc(e.model)}" data-chg="emodel" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="model id"><button class="sm" data-act="fetchmodels">Fetch list</button></div>
    <datalist id="modellist">${(e.models || []).map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
    ${e.note ? `<p class="small ${e.noteBad ? 'fail' : 'okc'}">${esc(e.note)}</p>` : ''}
    ${/^http:\/\//.test(e.baseUrl) && location.protocol === 'https:' ? '<p class="small fail">This page is served over HTTPS, so the browser will block a plain http:// endpoint. Put the local server behind HTTPS (see README: Tailscale Serve / Cloudflare Tunnel) and allow this origin in its CORS settings.</p>' : ''}
    <div class="row wrap" style="margin-top:10px"><button class="primary" data-act="saveprof">Save</button><button data-act="testprof">Test</button><button data-act="cancelprof">Cancel</button>${e.isNew ? '' : '<button class="danger" data-act="delprof">Delete</button>'}</div></div>`
    : '<button class="primary" data-act="newprof">Add profile</button>'}</div>`;
}

// --------------------------------------------------------------------- game
const mixColor = (hex, t) => { const a = [220, 207, 174], n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; return `rgb(${a.map((v, i) => Math.round(v + (c[i] - v) * t)).join(',')})`; };
const unitPos = (p) => [PROV[p].x, PROV[p].y + 6];

function unitSvg(p, u, cls = '', dx = 0, dy = 0) {
  const [x0, y0] = unitPos(p), x = x0 + dx, y = y0 + dy, c = G.powers[u.power].color;
  const body = u.type === 'A' ? `<rect class="body" x="${x - 11}" y="${y - 11}" width="22" height="22" rx="5" fill="${c}"/>` : `<circle class="body" cx="${x}" cy="${y}" r="12.5" fill="${c}"/>`;
  return `<g class="unit ${cls}" data-p="${p}">${body}<text x="${x}" y="${y + 4.5}">${u.type}</text></g>`;
}
function arrow(a, b, color, cls = '', short = 15) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const e = [b[0] - ux * short, b[1] - uy * short], s = [a[0] + ux * 10, a[1] + uy * 10];
  const h1 = [e[0] - ux * 11 - uy * 6, e[1] - uy * 11 + ux * 6], h2 = [e[0] - ux * 11 + uy * 6, e[1] - uy * 11 - ux * 6];
  return `<path class="arrow ${cls}" stroke="${color}" d="M${s[0]},${s[1]}L${e[0]},${e[1]}M${h1[0]},${h1[1]}L${e[0]},${e[1]}L${h2[0]},${h2[1]}"/>`;
}
function orderSvg(o, color, bad) {
  const cls = bad ? 'bad' : '';
  if (o.t === 'M') return arrow(unitPos(o.p), unitPos(o.to), color, cls) + (bad ? `<text x="${(unitPos(o.p)[0] + unitPos(o.to)[0]) / 2}" y="${(unitPos(o.p)[1] + unitPos(o.to)[1]) / 2 + 5}" fill="#ff5a4a" font-size="18" font-weight="700" text-anchor="middle" pointer-events="none">✕</text>` : '');
  if (o.t === 'S') { const a = unitPos(o.from), b = unitPos(o.to); const t = o.to === o.from ? a : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return arrow(unitPos(o.p), t, color, 'sup ' + cls, 6); }
  if (o.t === 'C') return arrow(unitPos(o.p), unitPos(o.from), color, 'con ' + cls, 14);
  return '';
}

function highlights() {
  if (ui.report || ui.cur == null || G.state.phase !== 'orders' || !ui.sel) return { sel: null, targets: [] };
  const s = G.state, p = ui.sel, u = s.units[p];
  let targets = [];
  if (ui.mode === 'move' || ui.mode === 'moveStrict') targets = moveTargets(s, p);
  else if (ui.mode === 'support') {
    if (!ui.supFrom) targets = Object.keys(s.units).filter((q) => q !== p && (adjFor(u.type, p).includes(q) || moveTargets(s, q).some((d) => adjFor(u.type, p).includes(d))));
    else targets = [ui.supFrom, ...moveTargets(s, ui.supFrom)].filter((d) => isValid(s, { p, t: 'S', from: ui.supFrom, to: d }));
  } else if (ui.mode === 'convoy') {
    if (!ui.supFrom) targets = Object.keys(s.units).filter((q) => s.units[q].type === 'A' && isCoast(q));
    else targets = IDS.filter((d) => isCoast(d) && d !== ui.supFrom);
  }
  return { sel: p, targets };
}

function renderMap() {
  const svg = $('#map'); if (!svg) return;
  const s = G.state, rep = ui.report && ui.report.kind === 'orders' ? ui.report : null;
  const units = rep ? rep.before.units : s.units;
  const { sel, targets } = highlights();
  let out = '';
  for (const id of IDS) {
    const p = PROV[id], o = s.owners[id];
    const fill = p.kind === 'sea' ? (id === 'MAW' ? '#235579' : '#2a5f8a') : (p.sc && o != null ? mixColor(G.powers[o].color, 0.55) : '#dccfae');
    out += `<polygon class="prov ${p.kind}" data-p="${id}" points="${p.poly.map((v) => v[0].toFixed(1) + ',' + v[1].toFixed(1)).join(' ')}" fill="${fill}"/>`;
  }
  for (const id of IDS) {
    const p = PROV[id];
    out += `<text class="plabel ${p.kind}" x="${p.x}" y="${p.y - 13}">${p.sc ? '★ ' : ''}${id}</text>`;
    if (p.role === 'cap') { const pw = G.powers[p.home]; if (!String(pw.logo).startsWith('data:')) out += `<text x="${p.x + 22}" y="${p.y + 12}" font-size="13" text-anchor="middle" pointer-events="none" opacity=".85">${esc(pw.logo)}</text>`; }
  }
  for (const t of targets) out += `<polygon class="hl t" points="${PROV[t].poly.map((v) => v.join(',')).join(' ')}"/>`;
  if (sel) out += `<polygon class="hl" points="${PROV[sel].poly.map((v) => v.join(',')).join(' ')}"/>`;
  // orders
  if (rep) { for (const p in rep.results) { const r = rep.results[p]; out += orderSvg(r.order, G.powers[r.power].color, !r.ok); } }
  else if (ui.cur != null && s.phase === 'orders') { const d = ui.drafts[ui.cur] || {}; for (const p in d) out += orderSvg(d[p], '#ffffff', false); }
  for (const p in units) out += unitSvg(p, units[p], rep && rep.results[p] && rep.results[p].dislodged ? 'ghost' : '');
  if (!rep) for (const p in s.dislodged) out += unitSvg(p, s.dislodged[p], 'ghost', 14, -12);
  svg.innerHTML = out;
  svg.setAttribute('viewBox', `${ui.vb.x} ${ui.vb.y} ${ui.vb.w} ${ui.vb.h}`);
  // overlay controls
  const act = $('#actions'), hint = $('#hint');
  let a = '', h = '';
  if (!ui.report && ui.cur != null && s.phase === 'orders') {
    if (sel) {
      const u = s.units[sel];
      a = `<button class="sm" data-act="ohold">Hold</button><button class="sm ${ui.mode === 'moveStrict' ? 'on' : ''}" data-act="omove">Move</button><button class="sm ${ui.mode === 'support' ? 'on' : ''}" data-act="osupport">Support</button>${u.type === 'F' && isSea(sel) ? `<button class="sm ${ui.mode === 'convoy' ? 'on' : ''}" data-act="oconvoy">Convoy</button>` : ''}<button class="sm" data-act="ocancel">✕</button>`;
      h = ui.mode === 'support' ? (ui.supFrom ? `Tap where ${ui.supFrom} is going (or ${ui.supFrom} itself to support its hold)` : 'Tap the unit to support') : ui.mode === 'convoy' ? (ui.supFrom ? 'Tap the army\'s destination coast' : 'Tap the army to convoy') : `${u.type} ${PROV[sel].name}: tap a highlighted province to move, or tap the unit again to hold`;
    } else h = 'Tap one of your units to give it an order';
  } else if (ui.info) h = ui.info;
  act.innerHTML = a; hint.innerHTML = h ? `<span>${esc(h)}</span>` : '';
}

function header() {
  const s = G.state, k = ui.cur;
  const ph = ui.report ? `${GM.seasonName(ui.report)} · Results` : s.phase === 'over' ? 'Game over' : `${GM.seasonName(s)} · ${{ orders: 'Orders', retreats: 'Retreats', builds: 'Builds' }[s.phase]}`;
  return `<button class="sm" data-act="menu">☰</button><span class="phase">${esc(ph)}</span><span class="who">${k != null ? `${logo(G.powers[k])}<b>${esc(G.powers[k].name)}</b> · ${scCount(s, k)}★` : '<span class="dim">Spectating</span>'}</span>`;
}

function renderGame() {
  if (!$('#game')) {
    app.innerHTML = `<div id="game" style="display:flex;flex-direction:column;flex:1;min-height:0"><div class="top" id="top"></div>
      <div id="mapwrap"><svg id="map" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"></svg><div id="actions"></div><div id="hint"></div></div>
      <div class="tabs" id="tabs"></div><div id="panel"></div></div><div id="overlay"></div>`;
    bindMap();
  }
  $('#top').innerHTML = header();
  renderMap(); renderPanel(); renderOverlay();
}

function unreadTotal(k) { return k == null ? 0 : G.messages.filter((m) => m.to === k && !m.read).length; }
function renderPanel() {
  const panel = $('#panel'); if (!panel) return;
  const active = document.activeElement && document.activeElement.id === 'chatInput';
  const tabs = ui.report ? [] : ui.cur != null ? [['orders', 'Orders'], ['talk', 'Diplomacy'], ['status', 'Powers'], ['log', 'History']] : [['status', 'Powers'], ['log', 'History']];
  if (!ui.report && !tabs.some((t) => t[0] === ui.tab)) ui.tab = tabs[0][0];
  $('#tabs').innerHTML = tabs.map(([id, l]) => `<button class="${ui.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${l}${id === 'talk' && unreadTotal(ui.cur) ? `<span class="badge">${unreadTotal(ui.cur)}</span>` : ''}</button>`).join('');
  $('#tabs').style.display = tabs.length ? '' : 'none';
  let html = '';
  if (ui.report) html = reportHtml(ui.report, true);
  else if (G.state.phase === 'over') html = overHtml();
  else if (ui.tab === 'orders') html = ordersHtml();
  else if (ui.tab === 'talk') html = talkHtml();
  else if (ui.tab === 'status') html = statusHtml();
  else html = G.history.length ? [...G.history].reverse().map((r) => reportHtml(r, false)).join('') : '<p class="dim">Nothing has happened yet.</p>';
  if (!ui.report && ui.cur == null && G.state.phase === 'orders' && !ui.busy) html = '<button class="primary" style="width:100%;margin-bottom:8px" data-act="runturn">Run turn</button>' + html;
  panel.innerHTML = html;
  if (active) { const i = $('#chatInput'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  if (ui.tab === 'talk' && ui.chatWith != null && ui.scrollChat) { panel.scrollTop = panel.scrollHeight; ui.scrollChat = false; }
}

function overHtml() {
  const w = G.state.winner;
  return `<div style="text-align:center;padding:20px">${w != null ? `${logo(G.powers[w], 'big')}<h2>${esc(G.powers[w].name)} wins</h2><p class="dim">${scCount(G.state, w)} supply centres in year ${G.state.year}.</p>` : '<h2>Game ended</h2>'}<button class="primary" data-act="quit">Back to menu</button></div>` + statusHtml();
}

function ordersHtml() {
  const s = G.state, k = ui.cur;
  if (s.phase === 'orders') {
    const d = ui.drafts[k] || {}, mine = unitsOf(s, k);
    return `<div class="list">${mine.map((p) => `<div data-act="selunit" data-p="${p}"><span class="mono grow">${esc(fmtOrder(s, d[p] || { p, t: 'H' }))}</span><span class="dim small">${esc(PROV[p].name)}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button data-act="clearorders">Clear all</button><button class="primary grow" data-act="submit">Submit orders</button></div>
      ${ui.dipBusy ? '<p class="dim small">Other powers are still conferring…</p>' : ''}`;
  }
  if (s.phase === 'retreats') {
    const mine = Object.keys(s.dislodged).filter((p) => s.dislodged[p].power === k);
    return `<p>Your dislodged units must retreat or disband.</p>${mine.map((p) => { const d = s.dislodged[p], cur = ui.retreats[p]; return `<div class="card"><b>${d.type} ${esc(PROV[p].name)}</b><div class="row wrap" style="margin-top:6px">${d.options.map((o) => `<button class="sm ${cur === o ? 'on' : ''}" data-act="retreat" data-p="${p}" data-to="${o}">${esc(PROV[o].name)}</button>`).join('')}<button class="sm ${cur == null ? 'on' : ''}" data-act="retreat" data-p="${p}" data-to="">Disband</button></div></div>`; }).join('')}
      <button class="primary" style="width:100%" data-act="submit">Confirm retreats</button>`;
  }
  if (s.phase === 'builds') {
    const delta = buildDeltas(s)[k];
    if (delta > 0) {
      const b = ui.builds; const n = Object.values(b).filter(Boolean).length;
      return `<p>You may build <b>${delta}</b> unit${delta > 1 ? 's' : ''} (${n} chosen).</p>${buildSites(s, k).map((p) => `<div class="card row"><b class="grow">${esc(PROV[p].name)}</b><button class="sm ${b[p] === 'A' ? 'on' : ''}" data-act="build" data-p="${p}" data-type="A">Army</button>${isCoast(p) ? `<button class="sm ${b[p] === 'F' ? 'on' : ''}" data-act="build" data-p="${p}" data-type="F">Fleet</button>` : ''}</div>`).join('')}
      <button class="primary" style="width:100%" data-act="submit">Confirm builds</button>`;
    }
    const n = Object.values(ui.disb).filter(Boolean).length;
    return `<p>You must disband <b>${-delta}</b> unit${delta < -1 ? 's' : ''} (${n} chosen). Unchosen disbands fall on the units farthest from home.</p><div class="row wrap">${unitsOf(s, k).map((p) => `<button class="sm ${ui.disb[p] ? 'on' : ''}" data-act="disband" data-p="${p}">${s.units[p].type} ${esc(PROV[p].name)}</button>`).join('')}</div>
      <button class="primary" style="width:100%;margin-top:10px" data-act="submit">Confirm disbands</button>`;
  }
  return '';
}

function talkHtml() {
  const k = ui.cur, s = G.state;
  if (ui.chatWith == null) {
    return `<div class="list">${G.powers.map((p, q) => (q === k || !alive(s, q) ? '' : `<div data-act="chat" data-q="${q}">${logo(p)}<span class="grow"><b>${esc(p.name)}</b> <span class="dim small">${esc(ctrlLabel(p.ctrl))}</span>${GM.treatyBetween(G, k, q) ? ` <span class="okc small">· ${GM.treatyBetween(G, k, q).type}</span>` : ''}</span>${GM.unreadFor(G, k, q) ? `<span class="badge">${GM.unreadFor(G, k, q)}</span>` : ''}<span class="dim">›</span></div>`)).join('')}</div>`;
  }
  const q = ui.chatWith, p = G.powers[q], t = GM.treatyBetween(G, k, q), ms = GM.thread(G, k, q);
  for (const m of ms) if (m.to === k) m.read = true;
  const others = G.powers.map((x, i) => i).filter((i) => i !== k && i !== q && alive(s, i));
  return `<div class="row"><button class="sm" data-act="chatback">‹</button>${logo(p)}<b class="grow">${esc(p.name)}</b>${t ? `<button class="sm danger" data-act="endpact">End ${t.type}</button>` : ''}</div>
    ${t ? `<p class="okc small">Pact in force: ${t.type}${t.vs != null ? ` against ${esc(G.powers[t.vs].name)}` : ''} (since year ${t.year}).</p>` : ''}
    <div class="msgs">${ms.map((m) => `<div class="msg ${m.system ? 'sys' : m.from === k ? 'me' : ''}">${esc(m.text)}${m.proposal && m.proposal.status === 'pending' && m.to === k ? `<div class="row" style="margin-top:6px"><button class="sm primary" data-act="accept" data-id="${m.id}">Accept</button><button class="sm" data-act="decline" data-id="${m.id}">Decline</button></div>` : ''}${m.proposal && ['accepted', 'declined'].includes(m.proposal.status) ? `<span class="when">${m.proposal.status}</span>` : ''}<span class="when">${m.season} Y${m.year}</span></div>`).join('') || '<p class="dim small">No messages yet.</p>'}
    ${ui.typing[q] ? '<div class="msg sys">…thinking</div>' : ''}</div>
    <div class="row wrap"><button class="sm" data-act="propose" data-type="peace">Propose peace</button><select id="vsSel" style="width:auto;flex:1">${others.map((i) => `<option value="${i}">vs ${esc(G.powers[i].name)}</option>`).join('')}</select><button class="sm" data-act="propose" data-type="alliance">Propose alliance</button></div>
    <div class="chatbar"><input type="text" id="chatInput" value="${esc(ui.chatDraft)}" data-chg="chatdraft" placeholder="Message ${esc(p.name)}…" enterkeyhint="send"><button class="primary" data-act="send">Send</button></div>`;
}

function statusHtml() {
  const s = G.state, k = ui.cur;
  const rows = G.powers.map((p, i) => ({ p, i, n: scCount(s, i), u: unitsOf(s, i).length })).sort((a, b) => b.n - a.n);
  const pacts = G.treaties.filter((t) => k == null || t.a === k || t.b === k);
  return `<table><tr><th></th><th>Power</th><th>★</th><th>Units</th><th>Played by</th></tr>${rows.map(({ p, i, n, u }) => `<tr style="${alive(s, i) ? '' : 'opacity:.4'}"><td>${logo(p)}</td><td><b>${esc(p.name)}</b></td><td>${n}</td><td>${u}</td><td class="dim small">${esc(ctrlLabel(p.ctrl))}${p.ctrl === 'engine' ? ' · ' + p.level : ''}</td></tr>`).join('')}</table>
  <p class="dim small">${WIN_SCS} centres win. ${SCS.filter((c) => s.owners[c] == null).length} still unowned.</p>
  ${pacts.length ? `<h3>${k == null ? 'Pacts' : 'Your pacts'}</h3>${pacts.map((t) => `<p class="small">${esc(G.powers[t.a].name)} – ${esc(G.powers[t.b].name)}: ${t.type}${t.vs != null ? ` against ${esc(G.powers[t.vs].name)}` : ''}</p>`).join('')}` : ''}`;
}

function reportHtml(r, live) {
  const title = `${r.season === 'spring' ? 'Spring' : 'Fall'}, Year ${r.year}`;
  let body = '';
  if (r.kind === 'orders') {
    const st = { units: Object.fromEntries(Object.entries(r.results).map(([p, x]) => [p, { type: x.type }])) };
    const by = {}; for (const p in r.results) (by[r.results[p].power] = by[r.results[p].power] || []).push(r.results[p]);
    body = (r.events || []).map((e) => `<p class="fail"><b>${esc(e)}</b></p>`).join('') + Object.keys(by).map((k) => `<div style="margin:6px 0"><span class="chip">${logo(G.powers[k])}${esc(G.powers[k].name)}</span><div class="mono" style="margin:4px 0 0 6px">${by[k].map((x) => `<div class="${x.ok ? '' : 'fail'}">${esc(fmtOrder(st, x.order))}${x.ok ? '' : ' — fails'}${x.dislodged ? ' — <b>dislodged</b>' : ''}</div>`).join('')}</div></div>`).join('');
  } else if (r.kind === 'retreats') body = r.log.map((x) => `<div class="mono">${esc(G.powers[x.power].name)}: ${x.type} ${x.p} ${x.to ? '→ ' + x.to : x.bounced ? 'retreat bounced, disbanded' : 'disbanded'}</div>`).join('');
  else body = r.log.map((x) => `<div class="mono">${esc(G.powers[x.power].name)}: ${x.build ? 'builds' : 'disbands'} ${x.type} ${x.p}</div>`).join('') || '<div class="dim small">No changes.</div>';
  const kind = { orders: 'Movement', retreats: 'Retreats', builds: 'Adjustments' }[r.kind];
  return live ? `<div class="row"><h2 class="grow" style="margin:0">${title} — results</h2><button class="primary" data-act="continueTurn">Continue</button></div>${body}<button class="primary" style="width:100%;margin-top:12px" data-act="continueTurn">Continue</button>`
    : `<div class="card"><b>${title} · ${kind}</b>${body}</div>`;
}

function renderOverlay() {
  const o = $('#overlay'); if (!o) return;
  if (ui.busy) o.innerHTML = `<div class="busy"><div>${esc(ui.busy.text)}</div><div class="bar"><i style="width:${Math.round((ui.busy.p || 0) * 100)}%"></i></div></div>`;
  else if (ui.curtain && ui.cur != null) { const p = G.powers[ui.cur]; o.innerHTML = `<div class="curtain">${logo(p, 'big')}<h2>Pass the device to ${esc(p.name)}</h2><p class="dim">${esc(GM.seasonName(G.state))} · ${G.state.phase}</p><button class="primary" data-act="ready" style="padding:14px 28px">I am ${esc(p.name)}</button></div>`; }
  else if (ui.menu) o.innerHTML = `<div class="busy" data-act="closemenu"><div class="card stack" style="min-width:240px"><button style="width:100%" data-act="closemenu">Resume</button><button style="width:100%" data-act="resetview">Reset map view</button><button style="width:100%" data-act="helpgame">How to play</button><button style="width:100%" data-act="quit">Save &amp; exit to menu</button><button class="danger" style="width:100%" data-act="abandon">Abandon game</button></div></div>`;
  else o.innerHTML = '';
}

// --------------------------------------------------------------- game flow
const hooks = { onUpdate: () => { if (ui.screen === 'game') { GM.saveGame(G); renderPanel(); } }, onError: (m) => toast(m, 7000) };
const humanCount = () => G.powers.filter((p) => p.ctrl === 'human').length;

function enterPhase() {
  const s = G.state;
  ui.sel = null; ui.mode = null; ui.supFrom = null; ui.report = null; ui.submitted = {}; ui.retreats = {}; ui.builds = {}; ui.disb = {}; ui.info = '';
  GM.saveGame(G);
  if (s.phase === 'over') { ui.cur = null; ui.queue = []; return render(); }
  ui.queue = GM.humansToAct(G);
  if (s.phase === 'orders') {
    ui.drafts = {}; ui.dipBusy = true;
    ui.dip = GM.beginDiplomacy(G, hooks).catch((e) => toast(String(e.message || e))).then(() => { ui.dipBusy = false; if (ui.screen === 'game') renderPanel(); });
  }
  if (!ui.queue.length) {
    if (s.phase === 'orders') { ui.cur = null; ui.info = 'No human orders needed this phase.'; render(); if (humanCount()) return resolveNow(); ui.info = 'All powers are AI. Use Run turn.'; ui.tab = 'status'; return render(); }
    return resolveNow();
  }
  nextHuman();
}
function nextHuman() {
  ui.cur = ui.queue.shift(); ui.sel = null; ui.mode = null; ui.chatWith = null; ui.chatDraft = ''; ui.tab = 'orders';
  ui.retreats = {}; ui.builds = {}; ui.disb = {};
  if (G.state.phase === 'retreats') for (const p in G.state.dislodged) if (G.state.dislodged[p].power === ui.cur) ui.retreats[p] = G.state.dislodged[p].options[0] || null;
  ui.curtain = humanCount() > 1;
  render();
}
async function resolveNow() {
  const s = G.state;
  try {
    if (s.phase === 'orders') {
      ui.busy = { text: 'Powers are finalising orders…', p: 0 }; renderOverlay();
      await ui.dip;
      const report = await GM.resolveOrders(G, ui.submitted.orders || {}, { ...hooks, onProgress: (p) => { ui.busy.p = p; renderOverlay(); }, onStage: (t) => { ui.busy.text = t; renderOverlay(); } });
      ui.busy = null; ui.report = report; ui.cur = humanCount() === 1 ? G.powers.findIndex((p) => p.ctrl === 'human') : null;
      GM.saveGame(G); return render();
    }
    if (s.phase === 'retreats') GM.resolveRetreats(G, ui.submitted.retreats || {});
    else if (s.phase === 'builds') GM.resolveBuilds(G, ui.submitted.builds || [], ui.submitted.disbands || []);
  } catch (e) { ui.busy = null; toast('Error: ' + (e.message || e), 8000); console.error(e); return render(); }
  enterPhase();
}
function submit() {
  const s = G.state, k = ui.cur;
  if (s.phase === 'orders') { (ui.submitted.orders = ui.submitted.orders || {})[k] = unitsOf(s, k).map((p) => (ui.drafts[k] || {})[p] || { p, t: 'H' }); }
  else if (s.phase === 'retreats') Object.assign((ui.submitted.retreats = ui.submitted.retreats || {}), ui.retreats);
  else if (s.phase === 'builds') {
    const delta = buildDeltas(s)[k];
    if (delta > 0) { const chosen = Object.entries(ui.builds).filter(([, t]) => t); if (chosen.length > delta) return toast(`You can build at most ${delta}.`); (ui.submitted.builds = ui.submitted.builds || []).push(...chosen.map(([p, type]) => ({ power: k, p, type }))); }
    else (ui.submitted.disbands = ui.submitted.disbands || []).push(...Object.keys(ui.disb).filter((p) => ui.disb[p]).map((p) => ({ power: k, p })));
  }
  if (ui.queue.length) nextHuman(); else { ui.cur = null; resolveNow(); }
}

function setOrder(o) {
  const k = ui.cur; if (!isValid(G.state, o)) return toast('That order is not legal.');
  (ui.drafts[k] = ui.drafts[k] || {})[o.p] = o; ui.sel = null; ui.mode = null; ui.supFrom = null;
  renderMap(); renderPanel();
}
function tapProvince(id) {
  const s = G.state, k = ui.cur;
  if (ui.report || k == null || s.phase !== 'orders' || ui.curtain) { ui.info = `${PROV[id].name}${PROV[id].sc ? ' ★' : ''}${s.owners[id] != null ? ' · ' + G.powers[s.owners[id]].name : ''}`; return renderMap(); }
  const u = s.units[id], mine = u && u.power === k;
  if (!ui.sel) { if (mine) { ui.sel = id; ui.mode = 'move'; } else ui.info = PROV[id].name; return renderMap(); }
  const p = ui.sel;
  if (ui.mode === 'move' || ui.mode === 'moveStrict') {
    if (id === p) return setOrder({ p, t: 'H' });
    if (mine && ui.mode === 'move') { ui.sel = id; return renderMap(); }
    if (moveTargets(s, p).includes(id)) return setOrder({ p, t: 'M', to: id });
    ui.sel = null; ui.mode = null; return renderMap();
  }
  if (ui.mode === 'support') {
    if (!ui.supFrom) { if (u && id !== p) ui.supFrom = id; return renderMap(); }
    return setOrder({ p, t: 'S', from: ui.supFrom, to: id });
  }
  if (ui.mode === 'convoy') {
    if (!ui.supFrom) { if (u && u.type === 'A') ui.supFrom = id; return renderMap(); }
    return setOrder({ p, t: 'C', from: ui.supFrom, to: id });
  }
}

// ------------------------------------------------------------- map gestures
function bindMap() {
  const wrap = $('#mapwrap'), pts = new Map(); let moved = 0, pinch = null, start = null;
  const toSvg = (e) => { const r = wrap.getBoundingClientRect(), sc = Math.max(ui.vb.w / r.width, ui.vb.h / r.height); return { sc, r }; };
  const clampVb = () => { const v = ui.vb; v.w = Math.max(220, Math.min(W, v.w)); v.h = v.w; v.x = Math.max(-80, Math.min(W + 80 - v.w, v.x)); v.y = Math.max(-80, Math.min(H + 80 - v.h, v.y)); $('#map').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); };
  const zoomAt = (cx, cy, f) => { const { sc, r } = toSvg(); const ox = (r.width - ui.vb.w / sc) / 2, oy = (r.height - ui.vb.h / sc) / 2; const sx = ui.vb.x + (cx - r.left - ox) * sc, sy = ui.vb.y + (cy - r.top - oy) * sc; const nw = Math.max(220, Math.min(W, ui.vb.w * f)), k = nw / ui.vb.w; ui.vb.x = sx - (sx - ui.vb.x) * k; ui.vb.y = sy - (sy - ui.vb.y) * k; ui.vb.w = nw; ui.vb.h = nw; clampVb(); };
  wrap.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 1) { moved = 0; start = [e.clientX, e.clientY]; } pinch = null; });
  wrap.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { const { sc } = toSvg(); moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]); if (moved > 8) { ui.vb.x -= (e.clientX - prev[0]) * sc; ui.vb.y -= (e.clientY - prev[1]) * sc; clampVb(); } }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch / d); pinch = d; moved = 99; }
  });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); pinch = null;
    if (pts.size === 0 && moved <= 8 && e.type === 'pointerup') { const el = document.elementFromPoint(e.clientX, e.clientY); const t = el && el.closest && el.closest('[data-p]'); if (t && t.closest('#map')) tapProvince(t.dataset.p); }
  };
  wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
  wrap.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
}

// ------------------------------------------------------------------ actions
function newSetup() { ui.setup = { powers: DEFAULT_POWERS.map((p, i) => ({ ...p, sel: i === 0 ? 'human' : 'engine:hard' })), negRounds: 1, llmOrders: true }; }
function fileToLogo(file) {
  return new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(file); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const m = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 96, 96); URL.revokeObjectURL(url); res(c.toDataURL('image/png')); }; img.onerror = rej; img.src = url; });
}
const A = {
  home() { ui.screen = 'home'; ui.setup = null; ui.edit = null; render(); },
  help() { ui.screen = 'help'; render(); },
  new() { newSetup(); ui.screen = 'setup'; render(); },
  models() { ui.screen = 'models'; ui.edit = null; render(); },
  backsetup() { ui.screen = 'setup'; render(); },
  continue() { G = GM.loadGame(); if (!G) return; ui.screen = 'game'; app.innerHTML = ''; G.dipDone = G.state.phase === 'orders' ? G.dipDone : ''; enterPhase(); },
  start() {
    const s = ui.setup;
    const powers = s.powers.map((p) => { const [c, lvl] = p.sel.split(':'); return { name: p.name.trim() || 'Unnamed', color: p.color, logo: p.logo || '●', ctrl: c === 'engine' ? 'engine' : p.sel, level: c === 'engine' ? lvl : 'hard' }; });
    G = GM.createGame(powers, { negRounds: s.negRounds, llmOrders: s.llmOrders });
    ui.screen = 'game'; ui.setup = null; ui.vb = { x: 0, y: 0, w: W, h: H }; app.innerHTML = ''; enterPhase();
  },
  plogo(d) { ui.logoFor = +d.i; $('#logofile').click(); },
  // model profiles
  newprof() { const p = PRESETS[0]; ui.edit = { isNew: true, id: 'p' + Date.now().toString(36), preset: p.id, kind: p.kind, label: p.label, baseUrl: p.baseUrl, apiKey: '', model: p.model, models: p.models || [] }; render(); },
  editprof(d) { const p = loadProfiles().find((x) => x.id === d.id); ui.edit = { ...p, models: (PRESETS.find((x) => x.id === p.preset) || {}).models || [] }; render(); },
  cancelprof() { ui.edit = null; render(); },
  saveprof() { const e = ui.edit; if (!e.model.trim()) { e.note = 'Enter a model id.'; e.noteBad = true; return render(); } const ps = loadProfiles().filter((p) => p.id !== e.id); ps.push({ id: e.id, preset: e.preset, kind: e.kind, label: e.label.trim() || e.model, baseUrl: e.baseUrl.trim(), apiKey: e.apiKey.trim(), model: e.model.trim() }); saveProfiles(ps); ui.edit = null; render(); },
  delprof() { saveProfiles(loadProfiles().filter((p) => p.id !== ui.edit.id)); ui.edit = null; render(); },
  async fetchmodels() { const e = ui.edit; e.note = 'Fetching…'; e.noteBad = false; render(); try { e.models = await listModels(e); e.note = `${e.models.length} models found — pick from the list.`; } catch (x) { e.note = 'Could not list models: ' + x.message; e.noteBad = true; } render(); },
  async testprof() { const e = ui.edit; e.note = 'Testing…'; e.noteBad = false; render(); try { e.note = 'Connected. Model replied: ' + await testProfile(e); } catch (x) { e.note = x.message; e.noteBad = true; } render(); },
  // game
  tab(d) { ui.tab = d.tab; ui.chatWith = null; renderPanel(); },
  ready() { ui.curtain = false; renderOverlay(); },
  menu() { ui.menu = true; renderOverlay(); },
  closemenu() { ui.menu = false; renderOverlay(); },
  resetview() { ui.vb = { x: 0, y: 0, w: W, h: H }; ui.menu = false; render(); },
  helpgame() { ui.menu = false; GM.saveGame(G); ui.screen = 'help'; render(); },
  quit() { ui.menu = false; if (G) GM.saveGame(G); ui.screen = 'home'; render(); },
  abandon() { if (!confirm('Abandon this game? It cannot be recovered.')) return; ui.menu = false; GM.clearGame(); G = null; ui.screen = 'home'; render(); },
  runturn() { resolveNow(); },
  continueTurn() { enterPhase(); },
  selunit(d) { ui.sel = d.p; ui.mode = 'move'; ui.supFrom = null; renderMap(); },
  ohold() { setOrder({ p: ui.sel, t: 'H' }); },
  omove() { ui.mode = 'moveStrict'; ui.supFrom = null; renderMap(); },
  osupport() { ui.mode = 'support'; ui.supFrom = null; renderMap(); },
  oconvoy() { ui.mode = 'convoy'; ui.supFrom = null; renderMap(); },
  ocancel() { ui.sel = null; ui.mode = null; ui.supFrom = null; renderMap(); },
  clearorders() { ui.drafts[ui.cur] = {}; renderMap(); renderPanel(); },
  submit() { submit(); },
  retreat(d) { ui.retreats[d.p] = d.to || null; renderPanel(); },
  build(d) { ui.builds[d.p] = ui.builds[d.p] === d.type ? null : d.type; renderPanel(); },
  disband(d) { ui.disb[d.p] = !ui.disb[d.p]; renderPanel(); },
  chat(d) { ui.chatWith = +d.q; ui.chatDraft = ''; ui.scrollChat = true; renderPanel(); },
  chatback() { ui.chatWith = null; renderPanel(); },
  async send() {
    const text = ui.chatDraft.trim(), q = ui.chatWith; if (!text) return;
    ui.chatDraft = ''; ui.typing[q] = GM.isLLM(G, q); ui.scrollChat = true;
    const from = ui.cur; await GM.sendMessage(G, from, q, text, hooks);
    ui.typing[q] = false; ui.scrollChat = true; GM.saveGame(G); renderPanel();
  },
  async propose(d) {
    const q = ui.chatWith, vs = d.type === 'alliance' ? +($('#vsSel') || {}).value : null;
    if (d.type === 'alliance' && !isFinite(vs)) return;
    ui.typing[q] = GM.isLLM(G, q); ui.scrollChat = true; renderPanel();
    await GM.propose(G, ui.cur, q, d.type, vs, hooks);
    ui.typing[q] = false; ui.scrollChat = true; GM.saveGame(G); renderPanel();
  },
  accept(d) { GM.answerProposal(G, +d.id, true); GM.saveGame(G); renderPanel(); },
  decline(d) { GM.answerProposal(G, +d.id, false); GM.saveGame(G); renderPanel(); },
  endpact() { GM.cancelTreaty(G, ui.cur, ui.chatWith); GM.saveGame(G); renderPanel(); },
};
const C = {
  pname(d, el) { ui.setup.powers[d.i].name = el.value; },
  pcolor(d, el) { ui.setup.powers[d.i].color = el.value; render(); },
  plogotxt(d, el) { if (el.value.trim()) { ui.setup.powers[d.i].logo = el.value.trim(); render(); } },
  pctrl(d, el) { ui.setup.powers[d.i].sel = el.value; },
  neg(d, el) { ui.setup.negRounds = +el.value; },
  llmorders(d, el) { ui.setup.llmOrders = el.checked; },
  epreset(d, el) { const p = PRESETS.find((x) => x.id === el.value), e = ui.edit; Object.assign(e, { preset: p.id, kind: p.kind, label: p.label, baseUrl: p.baseUrl, model: p.model, models: p.models || [], note: '' }); render(); },
  elabel(d, el) { ui.edit.label = el.value; }, ebase(d, el) { ui.edit.baseUrl = el.value; }, ekey(d, el) { ui.edit.apiKey = el.value; }, emodel(d, el) { ui.edit.model = el.value; },
  chatdraft(d, el) { ui.chatDraft = el.value; },
};
document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (!el) return; if (el.tagName === 'A') e.preventDefault(); const f = A[el.dataset.act]; if (f) { e.stopPropagation(); f(el.dataset, el); } });
document.addEventListener('input', (e) => { const el = e.target.closest('[data-chg]'); if (!el) return; const k = el.dataset.chg; if (['pname', 'elabel', 'ebase', 'ekey', 'emodel', 'chatdraft'].includes(k)) C[k](el.dataset, el); });
document.addEventListener('change', (e) => {
  if (e.target.id === 'logofile') { const f = e.target.files[0]; if (f) fileToLogo(f).then((u) => { ui.setup.powers[ui.logoFor].logo = u; render(); }).catch(() => toast('Could not read that image.')); return; }
  const el = e.target.closest('[data-chg]'); if (!el) return; const k = el.dataset.chg; if (C[k] && !['pname', 'elabel', 'ekey', 'emodel', 'chatdraft'].includes(k)) C[k](el.dataset, el);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'chatInput') { e.preventDefault(); A.send(); } });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__concordat = { ui, get G() { return G; } };
render();
