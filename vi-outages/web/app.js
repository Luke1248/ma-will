/* VI Power Watch: client. Vanilla JS, one payload from /api/status. */
(function () {
  "use strict";
  var TZ = "America/St_Thomas";
  var DISTRICT = { STTJ: "St. Thomas / St. John", STX: "St. Croix" };
  var ISLAND = { STT: "St. Thomas", STJ: "St. John", STX: "St. Croix", unknown: "Location not given" };
  var S = null;                      // latest status payload
  var prefs = load("prefs", {});     // {district, feeder}
  var myReport = load("report", null);
  var feederDistrict = prefs.district || "STTJ";

  function load(k, d) { try { return JSON.parse(localStorage.getItem("vipw." + k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem("vipw." + k, JSON.stringify(v)); } catch (e) {} }
  function deviceId() {
    var id = load("device", null);
    if (!id) {
      var a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.fill(7);
      id = Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      save("device", id);
    }
    return id;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(n) { return n == null ? "–" : Number(n).toLocaleString("en-US"); }
  function $(id) { return document.getElementById(id); }
  function fmtTime(iso) { return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }); }
  function fmtDay(iso) { return new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }); }
  function fmtWhen(iso) {
    var d = new Date(iso), same = fmtDay(iso) === fmtDay(new Date().toISOString());
    return (same ? "" : fmtDay(iso) + ", ") + fmtTime(iso);
  }
  function dur(hours) {
    if (hours == null) return "–";
    if (hours < 1) return Math.max(1, Math.round(hours * 60)) + " min";
    if (hours < 48) return (Math.round(hours * 10) / 10) + " hr";
    return Math.round(hours / 24) + " days";
  }
  function since(iso) { return (Date.now() - new Date(iso).getTime()) / 36e5; }
  function slot(min) { var h = Math.floor(min / 60) % 24, m = min % 60; return (h % 12 || 12) + (m ? ":" + ("0" + m).slice(-2) : "") + (h < 12 ? " AM" : " PM"); }

  /* ---------- estimate wording ---------- */
  function estimateHtml(e) {
    if (!e) return "";
    if (e.basis === "wapa") return '<div class="est"><div class="sub">WAPA’s stated restoration time</div><div class="big">' + fmtWhen(e.at) + "</div></div>";
    if (e.basis === "rotation") return '<div class="est"><div class="sub">End of WAPA’s scheduled rotation slot (plus WAPA’s 15-minute allowance)</div><div class="big">around ' + fmtWhen(e.at) + '</div><p class="note">WAPA calls its rotation schedule tentative. It can change with demand.</p></div>';
    if (e.basis === "history") return '<div class="est"><div class="sub">Estimate from past outages like this one</div><div class="big">' + fmtWhen(e.low) + " – " + fmtWhen(e.high) + '</div><div class="sub">Most likely around ' + fmtWhen(e.mid) + '</div><p class="note">WAPA has not posted a restoration time. This range is where the middle half of ' + num(e.sample) + " similar past outages ended, given this one has already lasted " + dur(e.elapsed_hours) + ". It is not a promise.</p></div>";
    return '<div class="est"><div class="sub">No estimate</div><p class="note">WAPA has not posted a restoration time, and too few past outages lasted this long to estimate from.</p></div>';
  }

  /* ---------- charts ---------- */
  function showTip(html, x, y) {
    var t = $("tip"); t.innerHTML = html; t.hidden = false;
    var w = t.offsetWidth, left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2));
    t.style.left = left + "px"; t.style.top = Math.max(8, y - t.offsetHeight - 14) + "px";
  }
  function hideTip() { $("tip").hidden = true; }

  function lineChart(points) {            // points: [{t, out}] hourly, single series
    if (!points || points.length < 2) return '<p class="note">No hourly history from WAPA yet.</p>';
    var W = 640, H = 170, L = 44, R = 8, T = 10, B = 24;
    var max = Math.max(10, Math.max.apply(null, points.map(function (p) { return p.out; })));
    var nice = niceMax(max), n = points.length;
    function x(i) { return L + (W - L - R) * i / (n - 1); }
    function y(v) { return T + (H - T - B) * (1 - v / nice); }
    var d = points.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.out).toFixed(1); }).join(" ");
    var area = d + " L" + x(n - 1).toFixed(1) + " " + y(0) + " L" + x(0) + " " + y(0) + " Z";
    var g = "";
    [0, 0.5, 1].forEach(function (f) {
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(nice * f) + '" y2="' + y(nice * f) + '"/>' +
        '<text class="axis" x="' + (L - 6) + '" y="' + (y(nice * f) + 4) + '" text-anchor="end">' + compact(nice * f) + "</text>";
    });
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i, k) {
      g += '<text class="axis" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + ["start", "middle", "end"][k] + '">' + esc(fmtDay(points[i].t).split(",")[0] + " " + fmtTime(points[i].t)) + "</text>";
    });
    return '<svg class="chart" id="hourly" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Customers without power, each of the last ' + n + ' hours, as counted by WAPA">' + g +
      '<path class="area" d="' + area + '"/><path class="line" d="' + d + '"/>' +
      '<line class="cross" id="hx" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/><circle class="dot" id="hd" r="4.5" visibility="hidden"/>' +
      '<rect id="hhit" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '" fill="transparent"/></svg>';
  }
  function wireLine(points) {
    var svg = $("hourly"); if (!svg) return;
    var W = 640, L = 44, R = 8, T = 10, B = 24, H = 170, n = points.length;
    var nice = niceMax(Math.max(10, Math.max.apply(null, points.map(function (p) { return p.out; }))));
    function move(ev) {
      var r = svg.getBoundingClientRect(), cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
      var vx = (cx - r.left) / r.width * W, i = Math.round((vx - L) / (W - L - R) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      var px = L + (W - L - R) * i / (n - 1), py = T + (H - T - B) * (1 - points[i].out / nice);
      $("hx").setAttribute("x1", px); $("hx").setAttribute("x2", px); $("hx").setAttribute("visibility", "visible");
      $("hd").setAttribute("cx", px); $("hd").setAttribute("cy", py); $("hd").setAttribute("visibility", "visible");
      showTip("<b>" + num(points[i].out) + "</b> customers out<br>" + esc(fmtWhen(points[i].t)), r.left + px / W * r.width, r.top + py / H * r.height);
    }
    function leave() { hideTip(); $("hx").setAttribute("visibility", "hidden"); $("hd").setAttribute("visibility", "hidden"); }
    svg.addEventListener("mousemove", move); svg.addEventListener("touchstart", move, { passive: true });
    svg.addEventListener("touchmove", move, { passive: true }); svg.addEventListener("mouseleave", leave); svg.addEventListener("touchend", leave);
  }
  function barChart(rows, id) {           // rows: [{date, customer_hours, max_out}] one district
    if (!rows.length) return '<p class="note">No daily history yet.</p>';
    var W = 640, H = 130, L = 44, R = 8, T = 8, B = 22, n = rows.length;
    var nice = niceMax(Math.max(10, Math.max.apply(null, rows.map(function (r) { return r.customer_hours; }))));
    var bw = (W - L - R) / n, g = "";
    [0, 1].forEach(function (f) {
      var yy = T + (H - T - B) * (1 - f);
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/><text class="axis" x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + compact(nice * f) + "</text>";
    });
    rows.forEach(function (r, i) {
      var h = Math.max(r.customer_hours > 0 ? 2 : 0, (H - T - B) * r.customer_hours / nice);
      g += '<rect class="bar" data-i="' + i + '" x="' + (L + i * bw + 1) + '" y="' + (H - B - h) + '" width="' + Math.max(1, bw - 2) + '" height="' + h + '" rx="' + Math.min(3, h / 2) + '"/>';
    });
    g += '<text class="axis" x="' + L + '" y="' + (H - 5) + '">' + esc(shortDate(rows[0].date)) + '</text><text class="axis" x="' + (W - R) + '" y="' + (H - 5) + '" text-anchor="end">' + esc(shortDate(rows[n - 1].date)) + "</text>";
    return '<svg class="chart" id="' + id + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Customer-hours without power per day">' + g + "</svg>";
  }
  function wireBars(id, rows) {
    var svg = $(id); if (!svg) return;
    function show(ev) {
      var t = ev.target; if (!t.dataset || t.dataset.i == null) return hideTip();
      var r = rows[+t.dataset.i], b = t.getBoundingClientRect();
      showTip("<b>" + esc(shortDate(r.date)) + "</b><br>" + num(Math.round(r.customer_hours)) + " customer-hours<br>peak " + num(r.max_out) + " out", b.left + b.width / 2, b.top);
    }
    svg.addEventListener("mousemove", show); svg.addEventListener("click", show); svg.addEventListener("mouseleave", hideTip);
  }
  function niceMax(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  function compact(v) { return v >= 1000 ? (Math.round(v / 100) / 10) + "k" : String(Math.round(v)); }
  function shortDate(d) { return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); }

  /* ---------- sections ---------- */
  function renderFeed() {
    var f = S.feed, el = $("feed");
    el.className = "feed" + (f.state === "ok" ? "" : " bad");
    if (f.state === "no_data") el.textContent = "No data from WAPA’s outage map yet" + (f.error ? " (cannot reach it)" : "");
    else if (f.state === "stale") el.textContent = "WAPA’s map last updated " + fmtWhen(f.wapa_updated) + ". Numbers may be out of date.";
    else el.textContent = "WAPA’s map updated " + fmtTime(f.wapa_updated) + " AST";
  }

  function renderNow() {
    var t = S.totals, h = "";
    if (S.feed.state === "no_data") {
      $("now").innerHTML = '<div class="banner warn">This app has not been able to read WAPA’s outage map yet. Nothing here is a current count.</div>' + generationCard();
      return;
    }
    if (S.feed.state === "stale") h += '<div class="banner warn"><b>WAPA’s outage map has stopped updating.</b> The figures below are from ' + esc(fmtWhen(S.feed.wapa_updated)) + ". A frozen map is not the same as no outages.</div>";
    if (S.notices && S.notices.banner && !/no programmed/i.test(S.notices.banner)) h += '<div class="banner out"><b>WAPA alert:</b> ' + esc(S.notices.banner) + "</div>";
    var pct = t.served ? (100 * t.out / t.served) : null;
    h += '<div class="card"><div class="hero-num">' + num(t.out) + '</div><div class="hero-label">customers without power, territory-wide' +
      (pct != null ? " · " + (pct < 0.1 && t.out ? "under 0.1" : pct.toFixed(1)) + "% of " + num(t.served) : "") + '</div>' +
      '<p class="note">' + num(t.records) + " outage " + (t.records === 1 ? "record" : "records") + " on WAPA’s map. A customer is one meter, not one person." +
      (t.lingering ? " " + num(t.lingering) + " small records have been open more than 3 days." : "") + "</p></div>";
    h += '<div class="grid2">' + ["STTJ", "STX"].map(function (d) {
      var x = S.districts[d];
      return '<div class="card"><h2>' + DISTRICT[d] + '</h2><div class="stat">' + num(x.out) + '</div><div class="sub">customers out</div>' +
        '<div class="kv"><span>Feeders with an outage</span><b>' + x.feeders_out + '</b></div>' +
        '<div class="kv"><span>Outage records</span><b>' + x.records + "</b></div>" + islandRows(d) + "</div>";
    }).join("") + "</div>";
    h += '<div class="card"><h2>Customers out, last 48 hours</h2>' + lineChart(S.hourly) + '<p class="note">Territory-wide, each hour, as WAPA’s map reports it.</p></div>';
    var active = [];
    ["STTJ", "STX"].forEach(function (d) { S.feeders[d].forEach(function (f) { if (f.active.length) active.push({ d: d, f: f }); }); });
    active.sort(function (a, b) { return b.f.out - a.f.out; });
    h += '<div class="card"><h2>Feeders out now</h2>' + (active.length ? '<ul class="list">' + active.map(function (a) {
      var first = a.f.active.reduce(function (m, r) { return !m || (r.start && r.start < m) ? r.start : m; }, null);
      return '<li><div class="row"><div><span class="fname">' + DISTRICT[a.d].split(" /")[0] + " Feeder " + esc(a.f.id) + '</span><div class="fspan">' + esc(a.f.span || a.f.areas.slice(0, 3).join(", ")) + '</div></div><span class="chip out">⚠ ' + num(a.f.out) + ' out</span></div>' +
        '<div class="sub">' + (first ? "Since " + esc(fmtWhen(first)) + " (" + dur(since(first)) + ")" : "") + "</div></li>";
    }).join("") + "</ul>" : '<p class="sub">WAPA’s map shows no feeder-level outage right now.</p>') + "</div>";
    h += localCard() + generationCard() + dailyCard();
    $("now").innerHTML = h;
    wireLine(S.hourly);
    ["STTJ", "STX"].forEach(function (d) { wireBars("daily-" + d, dailyRows(d)); });
  }
  function islandRows(d) {
    if (d !== "STTJ") return "";
    return ["STT", "STJ"].map(function (i) {
      var x = S.islands[i] || { out: 0 };
      return '<div class="kv"><span>' + ISLAND[i] + "</span><b>" + num(x.out) + "</b></div>";
    }).join("");
  }
  function localCard() {
    var rows = S.local.filter(function (r) { return !r.lingering; }), old = S.local.length - rows.length;
    var h = '<div class="card"><h2>Smaller outages</h2><p class="sub">Outages WAPA lists by transformer or line section, not by feeder.</p>';
    if (!rows.length) h += '<p class="sub">None newer than 3 days.</p>';
    else h += '<ul class="list">' + rows.slice(0, 40).map(function (r) {
      return '<li><div class="row"><div><span class="fname">' + esc(r.area || "Area not given") + '</span><div class="fspan">' + esc(ISLAND[r.island] || DISTRICT[r.district] || "") + (r.start ? " · since " + esc(fmtWhen(r.start)) : "") + (r.crew ? " · crew assigned" : "") + '</div></div><span class="chip warn">' + num(r.out) + " out</span></div></li>";
    }).join("") + "</ul>" + (rows.length > 40 ? '<p class="note">' + (rows.length - 40) + " more not shown.</p>" : "");
    if (old) h += '<p class="note">' + old + " more records have sat on WAPA’s map for over 3 days, usually 1 to 10 customers each.</p>";
    return h + "</div>";
  }
  function generationCard() {
    var g = S.generation, h = '<div class="card"><h2>Generation vs demand</h2><p class="sub">WAPA does not publish live capacity or load. These are the latest figures stated in public.</p>';
    ["STTJ", "STX"].forEach(function (d) {
      var x = g.districts[d];
      h += "<h3>" + esc(x.name) + '</h3><div class="kv"><span>Peak demand</span><b>' + range(x.peak_demand_mw) + '</b></div>' +
        '<div class="kv"><span>Reported shortfall</span><b>' + (x.shortfall_mw ? range(x.shortfall_mw) : "none stated") + '</b></div>' +
        '<div class="kv"><span>Available generation</span><b>not published</b></div>';
    });
    return h + '<p class="note">Each figure shows when it was stated. Reported in news coverage of WAPA statements and hearings. <a href="' + esc(g.monthly_production_url) + '" rel="noopener">WAPA’s monthly production report</a></p></div>';
  }
  function range(x) { return x ? (x.low === x.high ? x.low : x.low + "–" + x.high) + ' MW <span class="fspan">(' + esc(x.as_of) + ")</span>" : "–"; }
  function dailyRows(d) { return S.daily.filter(function (r) { return r.district === d; }); }
  function dailyCard() {
    var h = '<div class="card"><h2>Last 30 days</h2><p class="sub">Customer-hours without power per day. One customer out for one hour is one customer-hour.</p>';
    ["STTJ", "STX"].forEach(function (d) { h += "<h3>" + DISTRICT[d] + "</h3>" + barChart(dailyRows(d), "daily-" + d); });
    return h + '<p class="note">Built from WAPA’s own map counts. Days when the map was frozen or unreachable are missing, not zero. Scales differ between the two charts.</p></div>';
  }

  /* ---------- my power ---------- */
  function renderMine() {
    var d = prefs.district || "", h = '<div class="card"><h2>Where are you?</h2><label for="selD">District</label><select id="selD"><option value="">Choose…</option>' +
      ["STTJ", "STX"].map(function (k) { return '<option value="' + k + '"' + (k === d ? " selected" : "") + ">" + DISTRICT[k] + "</option>"; }).join("") + "</select>";
    if (d) {
      h += '<label for="q">Find your feeder by neighbourhood</label><input id="q" type="search" placeholder="e.g. Nazareth, Frenchtown, Kingshill" autocomplete="off"><div id="matches"></div>' +
        '<label for="selF">Feeder</label><select id="selF"><option value="">I don’t know my feeder</option>' +
        S.feeders[d].map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === prefs.feeder ? " selected" : "") + ">Feeder " + esc(f.id) + (f.span ? " · " + esc(f.span) : "") + "</option>"; }).join("") + "</select>" +
        '<p class="note">Your feeder is on WAPA’s rotation notices. Some estates are split across two or three feeders, so check <a href="' + esc("https://www.viwapa.vi/customer-service/feeder-listing") + '" rel="noopener">WAPA’s feeder listing</a> if unsure.</p>';
    }
    h += "</div>";
    if (d) h += statusCard(d) + reportCard(d);
    $("mine").innerHTML = h;
    $("selD").onchange = function () { prefs = { district: this.value, feeder: "" }; save("prefs", prefs); renderMine(); };
    if (!d) return;
    $("selF").onchange = function () { prefs.feeder = this.value; save("prefs", prefs); renderMine(); };
    $("q").oninput = function () {
      var q = this.value.trim().toLowerCase(), out = [];
      if (q.length >= 2) S.feeders[d].forEach(function (f) {
        var hit = f.areas.filter(function (a) { return a.toLowerCase().indexOf(q) >= 0; });
        if (hit.length) out.push('<button class="act" style="width:100%;margin-bottom:8px;text-align:left" data-f="' + esc(f.id) + '">Feeder ' + esc(f.id) + ' <span class="fspan">' + esc(hit.slice(0, 3).join(", ")) + "</span></button>");
      });
      $("matches").innerHTML = q.length >= 2 ? (out.join("") || '<p class="note">No match in WAPA’s listing, which covers major locations only.</p>') : "";
    };
    $("matches").onclick = function (ev) { var b = ev.target.closest("button"); if (b) { prefs.feeder = b.dataset.f; save("prefs", prefs); renderMine(); } };
    Array.prototype.forEach.call(document.querySelectorAll("[data-report]"), function (b) { b.onclick = function () { sendReport(d, b.dataset.report); }; });
  }
  function statusCard(d) {
    var f = prefs.feeder && S.feeders[d].filter(function (x) { return x.id === prefs.feeder; })[0];
    if (!f) {
      var x = S.districts[d];
      return '<div class="card"><h2>' + DISTRICT[d] + '</h2><div class="stat">' + num(x.out) + '</div><div class="sub">customers out in your district, on ' + x.feeders_out + " feeder" + (x.feeders_out === 1 ? "" : "s") + '</div><p class="note">Pick your feeder above for a status and restoration estimate.</p></div>';
    }
    var h = '<div class="card"><div class="row"><h2 style="margin:0">Feeder ' + esc(f.id) + "</h2>";
    if (S.feed.state !== "ok") h += '<span class="chip warn">? WAPA map not current</span></div>';
    else if (f.active.length) h += '<span class="chip out">⚠ Outage on WAPA’s map</span></div>';
    else h += '<span class="chip ok">✓ No feeder outage listed</span></div>';
    if (f.span) h += '<div class="fspan">' + esc(f.span) + "</div>";
    if (f.active.length) {
      var a = f.active.slice().sort(function (p, q) { return q.out - p.out; })[0];
      h += '<div class="kv"><span>Customers out</span><b>' + num(f.out) + '</b></div><div class="kv"><span>Started</span><b>' + (a.start ? esc(fmtWhen(a.start)) + " (" + dur(since(a.start)) + " ago)" : "–") + "</b></div>" +
        (a.cause ? '<div class="kv"><span>WAPA’s cause code</span><b>' + esc(a.cause.replace(/^\d+\s*/, "")) + "</b></div>" : "") +
        '<div class="kv"><span>Crew assigned</span><b>' + (a.crew ? "Yes" : "Not shown") + "</b></div>" + estimateHtml(a.estimate) +
        (f.active.length > 1 ? '<p class="note">WAPA lists ' + f.active.length + " separate records on this feeder. The estimate is for the largest.</p>" : "");
    } else {
      h += '<p class="sub" style="margin-top:10px">WAPA’s map shows no outage on the whole feeder. If your power is out it may be a smaller outage near you (see Now), or one WAPA has not posted. Report it to WAPA at 340-774-3552, option 4.</p>';
    }
    var next = nextRotation(d, f.id);
    if (next) h += '<div class="banner warn" style="margin:12px 0 0"><b>Possible rotation today:</b> ' + esc(next) + ". WAPA activates rotations only if demand requires.</div>";
    h += reportsLine(f.reports) + historyTable(f.history) + "</div>";
    return h;
  }
  function reportsLine(r) {
    if (!r || (!r.out && !r.on)) return '<p class="note">No neighbour reports in the last 90 minutes.</p>';
    return '<p class="note">Neighbour reports, last 90 minutes: <b>' + r.out + "</b> say out, <b>" + r.on + "</b> say on.</p>";
  }
  function historyTable(h) {
    if (!h) return '<h3>Outage history</h3><p class="note">No feeder-level outage recorded in the last 90 days.</p>';
    return '<h3>Outage history</h3><table><tr><th>Period</th><th>Outages</th><th>Hours out</th><th>Longest</th></tr>' +
      [["d7", "7 days"], ["d30", "30 days"], ["d90", "90 days"]].map(function (k) {
        var x = h[k[0]]; return "<tr><td>" + k[1] + "</td><td>" + x.count + "</td><td>" + x.hours + "</td><td>" + dur(x.longest) + "</td></tr>";
      }).join("") + '</table><p class="note">Counts feeder-level records on WAPA’s map. “Hours out” is time when at least part of the feeder was listed as out.</p>';
  }
  function nextRotation(d, id) {
    var today = new Date().toLocaleDateString("en-CA", { timeZone: TZ }), out = [];
    (S.notices.schedules || []).forEach(function (s) {
      if (s.district !== d || s.date !== today) return;
      s.slots.forEach(function (x) { if (x.feeders.some(function (f) { return f.feeder === id; })) out.push(slot(x.start) + "–" + slot(x.end)); });
    });
    return out.join(", ");
  }
  function reportCard(d) {
    var mine = myReport && myReport.district === d && myReport.feeder === (prefs.feeder || "") && Date.now() - myReport.t < 90 * 6e4 ? myReport.status : null;
    return '<div class="card"><h2>Is your power on?</h2><p class="sub">Tell your neighbours. Anonymous: no account, no location, no address.</p><div class="btns">' +
      '<button class="act out" data-report="out" aria-pressed="' + (mine === "out") + '">My power is out</button>' +
      '<button class="act on" data-report="on" aria-pressed="' + (mine === "on") + '">My power is on</button></div>' +
      '<p class="note" id="rmsg">' + (mine ? "Thanks. Your report counts for 90 minutes." : "This does not report the outage to WAPA. Call 340-774-3552, option 4, or use viwapa.vi.") + "</p></div>";
  }
  function sendReport(d, status) {
    var body = { district: d, feeder: prefs.feeder || null, status: status, device: deviceId() };
    fetch("api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "failed"); }); })
      .then(function () { myReport = { district: d, feeder: prefs.feeder || "", status: status, t: Date.now() }; save("report", myReport); return refresh(); })
      .catch(function (e) { var m = $("rmsg"); if (m) m.textContent = "Could not send your report (" + e.message + "). Check your connection and try again."; });
  }

  /* ---------- feeders ---------- */
  function renderFeeders() {
    var d = feederDistrict, h = '<div class="seg" role="group" aria-label="District">' + ["STTJ", "STX"].map(function (k) {
      return '<button data-d="' + k + '" aria-pressed="' + (k === d) + '">' + DISTRICT[k] + "</button>";
    }).join("") + "</div>";
    h += '<div class="card"><h2>Feeders, ' + DISTRICT[d] + '</h2><ul class="list">' + S.feeders[d].map(function (f) {
      var h30 = f.history && f.history.d30;
      return '<li><details><summary><div class="row"><div><span class="fname">Feeder ' + esc(f.id) + '</span> <span class="fspan">' + esc(ISLAND[f.island]) + '</span><div class="fspan">' + esc(f.span || f.areas.slice(0, 3).join(", ") || "Not in WAPA’s published listing") + "</div></div>" +
        (f.active.length ? '<span class="chip out">⚠ ' + num(f.out) + " out</span>" : '<span class="chip ok">✓ On</span>') + "</div>" +
        '<div class="sub">30 days: ' + (h30 ? h30.count + " outage" + (h30.count === 1 ? "" : "s") + ", " + h30.hours + " hr" : "no feeder outage") +
        (f.reports.out ? " · " + f.reports.out + " neighbour report" + (f.reports.out === 1 ? "" : "s") + " of power out" : "") + "</div></summary>" +
        (f.areas.length ? '<div class="areas">' + esc(f.areas.join(" · ")) + "</div>" : "") +
        (f.active.length ? estimateHtml(f.active[0].estimate) : "") + historyTable(f.history) + "</details></li>";
    }).join("") + '</ul><p class="note">“On” means WAPA’s map lists no outage for the whole feeder. Tap a feeder for its history.</p></div>';
    $("feeders").innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (b) { b.onclick = function () { feederDistrict = b.dataset.d; renderFeeders(); }; });
  }

  /* ---------- updates ---------- */
  function renderUpdates() {
    var n = S.notices || {}, h = "";
    h += '<div class="card"><h2>WAPA alert banner</h2><p class="sub">' + esc(n.banner || "Not available right now.") + "</p></div>";
    (n.schedules || []).forEach(function (s) {
      h += '<div class="card"><h2>Rotation schedule, ' + esc(DISTRICT[s.district] || "district not stated") + '</h2><p class="sub">' + esc(s.date ? shortDate(s.date) : "date not stated") + (s.tentative ? " · tentative: WAPA activates it only if demand requires" : "") + '</p><ul class="list">' +
        s.slots.map(function (x) {
          return '<li><div class="row"><b>' + slot(x.start) + " – " + slot(x.end) + '</b><span class="sub">' + x.feeders.map(function (f) { return esc(f.feeder) + (f.partial ? " (part)" : ""); }).join(", ") + "</span></div></li>";
        }).join("") + '</ul><p class="note">Read automatically from <a href="' + esc(s.url) + '" rel="noopener">WAPA’s schedule PDF</a>. Check the PDF if anything looks wrong. Restoration may lag by 15 minutes.</p></div>';
    });
    if (!(n.schedules || []).length) h += '<div class="card"><h2>Rotation schedule</h2><p class="sub">No readable schedule right now.' + ((n.schedule_links || []).length ? ' <a href="' + esc(n.schedule_links[0]) + '" rel="noopener">Open WAPA’s current schedule PDF</a>' : "") + "</p></div>";
    h += '<div class="card"><h2>WAPA news releases about power</h2>' + ((n.releases || []).length ? '<ul class="list">' + n.releases.map(function (r) {
      return '<li><a href="' + esc(r.url) + '" rel="noopener">' + esc(r.title) + '</a><div class="fspan">' + esc(shortDate(r.date)) + "</div></li>";
    }).join("") + "</ul>" : '<p class="sub">None loaded.</p>') + '<p class="note">For text and email alerts, sign up for WAPA Alerts at viwapa.vi.</p></div>';
    $("updates").innerHTML = h;
  }

  function renderAbout() {
    $("about").innerHTML = '<div class="card"><h2>What this is</h2><p class="sub">An independent, free tracker of power outages in the U.S. Virgin Islands. It is not run by or affiliated with WAPA.</p>' +
      '<h3>Where the numbers come from</h3><p class="sub">Outage counts are read every 5 minutes from WAPA’s public outage map. They are WAPA’s own report of who is out, not an independent measurement. When WAPA’s map freezes or goes offline, this app says so and stops counting, because missing data is not zero outage.</p>' +
      '<h3>What it cannot tell you</h3><p class="sub">WAPA’s map names the feeder only for feeder-wide outages. Smaller outages are listed by transformer, so they cannot be tied to a feeder. WAPA’s map does not publish restoration times, so the estimates here come from how long similar past outages lasted. WAPA publishes no live figure for generating capacity or load.</p>' +
      '<h3>History</h3><p class="sub">History before this app launched comes from VI Update’s public-domain archive of WAPA’s map, 23 March to 7 November 2026 (Brian Louden, doi:10.5281/zenodo.24094228).</p>' +
      '<h3>Your privacy</h3><p class="sub">No account. Your district and feeder are stored only on your phone. A power report sends your district, feeder and on/off, with a random device code so one phone counts once. No name, address or location.</p>' +
      '<h3>Emergencies</h3><p class="sub">Downed line or life-safety emergency: call 911. To report an outage to WAPA: 340-774-3552, option 4.</p></div>';
  }

  /* ---------- plumbing ---------- */
  function renderAll() { renderFeed(); renderNow(); renderMine(); renderFeeders(); renderUpdates(); renderAbout(); }
  function refresh() {
    return fetch("api/status", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { S = j; save("last", j); var open = document.activeElement && /INPUT|SELECT/.test(document.activeElement.tagName); if (!open) renderAll(); else { renderFeed(); } })
      .catch(function () {
        if (!S) { S = load("last", null); if (S) renderAll(); }
        var el = $("feed"); el.className = "feed bad";
        el.textContent = S ? "Offline. Showing what this phone last saw at " + fmtWhen(S.generated) + "." : "Cannot reach the server. Check your connection.";
      });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function (b) {
    b.onclick = function () {
      Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function (x) { x.removeAttribute("aria-current"); });
      b.setAttribute("aria-current", "page");
      Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (s) { s.hidden = s.id !== "tab-" + b.dataset.tab; });
      hideTip(); window.scrollTo(0, 0);
    };
  });
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
})();
