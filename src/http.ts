import { createServer, type OutgoingHttpHeaders, type Server } from "node:http";
import { URL } from "node:url";

import { cache, getBalanceEvents } from "./db.js";
import { playerInfo, sessionTotals, sessionStart } from "./stats.js";
import { WEB_PORT } from "./utils/config.js";

const JSON_HEADERS: OutgoingHttpHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Potat Farmer</title>
<style>
* { margin:0; padding:0; box-sizing:border-box }
body { background:#0d0d0d; color:#ccc; font:13px/1.6 'Courier New',monospace; padding:16px }
#page { display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:16px; max-width:1500px; margin:0 auto }
#charts { min-width:0; border:1px solid #333; align-self:start; background:#0d0d0d }
#box { border:1px solid #333; align-self:start }
.hdr { text-align:center; padding:6px 0; color:#fd0; font-weight:bold; border-bottom:1px solid #333; letter-spacing:2px }
.toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:8px; border-bottom:1px solid #333 }
.toolbar label { color:#666; display:flex; align-items:center; gap:5px }
.toolbar input,.toolbar button { background:#111; color:#ccc; border:1px solid #333; font:12px 'Courier New',monospace; padding:5px 7px; height:30px }
.toolbar button { color:#fd0; cursor:pointer }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px }
.plot { border:1px solid #333; min-width:0; background:#101010; position:relative }
.plot h2 { color:#0cc; font-size:13px; text-align:center; padding:6px; border-bottom:1px solid #333; font-weight:bold }
.plot canvas { display:block; width:100%; height:280px; cursor:crosshair }
.sec { padding:3px 0; border-top:1px solid #333; color:#0cc; font-weight:bold; text-align:center }
.row { display:flex; justify-content:space-between; padding:1px 14px }
.lbl { color:#666 }
.bt { border-top:1px solid #333 }
.green { color:#3c3 } .red { color:#c33 } .cyan { color:#0cc }
.yellow { color:#fd0 } .dim { color:#444 }
#foot { text-align:center; color:#444; font-size:11px; margin-top:8px }
#tip { position:fixed; z-index:10; pointer-events:none; min-width:190px; max-width:280px; background:#050505; border:1px solid #555; color:#ccc; padding:7px 9px; box-shadow:0 8px 24px #000; font-size:12px; line-height:1.45 }
#tip .t { color:#fd0; font-weight:bold; margin-bottom:2px }
#tip .k { color:#666 }
@media (max-width:1050px) {
  #page { grid-template-columns:1fr }
  #box { order:-1 }
}
@media (max-width:760px) {
  body { padding:10px }
  .grid { grid-template-columns:1fr }
  .plot canvas { height:240px }
}
</style>
</head>
<body>
<div id="page">
  <main id="charts">
    <div class="hdr">BALANCE HISTORY</div>
    <div class="toolbar">
      <label>From <input id="from" type="datetime-local"></label>
      <label>To <input id="to" type="datetime-local"></label>
      <button id="range24" type="button">24h</button>
      <button id="range7" type="button">7d</button>
      <button id="apply" type="button">Apply</button>
    </div>
    <div class="grid">
      <section class="plot"><h2>Overview</h2><canvas id="overview"></canvas></section>
      <section class="plot"><h2>Steal</h2><canvas id="steal"></canvas></section>
      <section class="plot"><h2>Harvest</h2><canvas id="harvest"></canvas></section>
      <section class="plot"><h2>Shop &amp; CDR</h2><canvas id="shop"></canvas></section>
    </div>
  </main>
  <aside id="box">
    <div class="hdr">POTAT FARMER</div>
    <div id="root">Loading&hellip;</div>
  </aside>
</div>
<div id="foot"></div>
<div id="tip" hidden></div>
<script>
const _esc = document.createElement('span')
function esc(s) { _esc.textContent = String(s || ''); return _esc.innerHTML }
function fmt(n) { return Number(n).toLocaleString() }
function pct(s, a) { return a ? Math.round(s / a * 100) + '%' : '0%' }
function delta(n) { return n > 0 ? '+' + fmt(n) : n < 0 ? '-' + fmt(-n) : '' }
function cls(n) { return n > 0 ? 'green' : n < 0 ? 'red' : '' }
function row(lbl, val, c) {
  return '<div class="row"><span class="lbl">' + lbl + '</span><span' + (c ? ' class="' + c + '"' : '') + '>' + val + '</span></div>'
}
function sec(label) { return '<div class="sec">' + label + '</div>' }
function statRows(s) {
  let out = ''
  if (s.farmAttempts > 0) {
    const fd = delta(s.farm)
    let fv = fmt(s.farmSuccesses) + ' / ' + fmt(s.farmAttempts) + ' (' + pct(s.farmSuccesses, s.farmAttempts) + ')'
    if (fd) fv += '&nbsp;&nbsp;<span class="' + cls(s.farm) + '">' + fd + '</span>'
    out += row('Farm:', fv)
  }
  if (s.stealAttempts > 0) {
    const sd = delta(s.steal)
    let sv = fmt(s.stealSuccesses) + ' / ' + fmt(s.stealAttempts) + ' (' + pct(s.stealSuccesses, s.stealAttempts) + ')'
    if (sd) sv += '&nbsp;&nbsp;<span class="' + cls(s.steal) + '">' + sd + '</span>'
    out += row('Steal:', sv)
  }
  if (s.rankups > 0) out += row('Rank Ups:', fmt(s.rankups), 'cyan')
  if (s.prestiges > 0) out += row('Prestiges:', fmt(s.prestiges), 'cyan')
  const total = s.farm + s.steal
  if (total !== 0) out += row('Total:', delta(total), cls(total))
  return out || row('', '&mdash;', 'dim')
}
function dur(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  if (h > 0) return h + 'h ' + m + 'm'
  if (m > 0) return m + 'm ' + s + 's'
  return s + 's'
}
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const chartDefs = [
  { id: 'overview', title: 'Overview', filter: e => true, mode: 'balance' },
  { id: 'steal', title: 'Steal', filter: e => e.category === 'steal', mode: 'delta' },
  { id: 'harvest', title: 'Potato / Harvest', filter: e => e.category === 'harvest', mode: 'delta' },
  { id: 'shop', title: 'Shop & CDR', filter: e => e.category === 'shop_cdr' || e.command === 'cdr' || e.command.startsWith('shop ') || e.command.includes('cooldown'), mode: 'delta' },
]
let latestEvents = []
let latestFrom = new Date(Date.now() - 86400000)
let latestTo = new Date()
let hover = null
function localInputValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}
function setRange(hours) {
  const to = new Date()
  const from = new Date(to.getTime() - hours * 3600000)
  document.getElementById('from').value = localInputValue(from)
  document.getElementById('to').value = localInputValue(to)
  refreshCharts()
}
function inputDate(id) {
  const v = document.getElementById(id).value
  return v ? new Date(v) : null
}
function niceNum(n) {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(/\\.0$/, '') + 'm'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\\.0$/, '') + 'k'
  return String(Math.round(n))
}
function hideTip() {
  document.getElementById('tip').hidden = true
}
function renderTip(point, canvas) {
  const tip = document.getElementById('tip')
  const changeClass = point.delta < 0 ? 'red' : point.delta > 0 ? 'green' : 'dim'
  tip.innerHTML =
    '<div class="t">' + esc(dateTimeFmt.format(new Date(point.executedAt))) + '</div>' +
    '<div><span class="k">Command:</span> ' + esc(point.command) + '</div>' +
    '<div><span class="k">Change:</span> <span class="' + changeClass + '">' + delta(point.delta) + '</span></div>' +
    '<div><span class="k">Balance:</span> ' + fmt(point.balanceAfter) + '</div>'
  tip.hidden = false
  const rect = canvas.getBoundingClientRect()
  const tipRect = tip.getBoundingClientRect()
  let left = rect.left + point.px + 12
  let top = rect.top + point.py - tipRect.height - 12
  if (left + tipRect.width > window.innerWidth - 8) left = rect.left + point.px - tipRect.width - 12
  if (top < 8) top = rect.top + point.py + 12
  tip.style.left = Math.max(8, left) + 'px'
  tip.style.top = Math.min(window.innerHeight - tipRect.height - 8, Math.max(8, top)) + 'px'
}
function nearestPoint(points) {
  if (!hover || points.length === 0) return null
  let best = null
  let bestDist = Infinity
  points.forEach(p => {
    const dx = p.px - hover.x, dy = p.py - hover.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestDist) {
      best = p
      bestDist = dist
    }
  })
  return bestDist <= 12 ? best : null
}
function redrawCharts() {
  hideTip()
  chartDefs.forEach(def => drawChart(def, latestEvents, latestFrom, latestTo))
}
function drawChart(def, events, from, to) {
  const canvas = document.getElementById(def.id)
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const w = rect.width, h = rect.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#101010'
  ctx.fillRect(0, 0, w, h)
  const pad = { l: 58, r: 14, t: 16, b: 34 }
  const pw = Math.max(1, w - pad.l - pad.r), ph = Math.max(1, h - pad.t - pad.b)
  const points = events.filter(def.filter).map(e => ({
    t: new Date(e.executedAt).getTime(),
    y: def.mode === 'balance' ? e.balanceAfter : e.delta,
    delta: e.delta,
    balanceAfter: e.balanceAfter,
    command: e.command,
    executedAt: e.executedAt,
  }))
  const start = from.getTime(), end = to.getTime()
  ctx.strokeStyle = '#2b2b2b'
  ctx.lineWidth = 1
  ctx.fillStyle = '#555'
  ctx.font = '11px Courier New'
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ph * i) / 4
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke()
  }
  for (let i = 0; i <= 3; i++) {
    const x = pad.l + (pw * i) / 3
    const label = timeFmt.format(new Date(start + ((end - start) * i) / 3))
    ctx.fillText(label, Math.min(x, w - pad.r - 42), h - 12)
  }
  if (points.length === 0) {
    ctx.fillStyle = '#444'
    ctx.textAlign = 'center'
    ctx.fillText('No balance changes in range', w / 2, h / 2)
    ctx.textAlign = 'left'
    return
  }
  let minY = Math.min(...points.map(p => p.y))
  let maxY = Math.max(...points.map(p => p.y))
  minY = Math.min(minY, 0)
  maxY = Math.max(maxY, 0)
  if (minY === maxY) { minY -= 1; maxY += 1 }
  const yPad = (maxY - minY) * 0.08
  minY -= yPad; maxY += yPad
  function x(t) { return pad.l + ((t - start) / Math.max(1, end - start)) * pw }
  function y(v) { return pad.t + (1 - (v - minY) / (maxY - minY)) * ph }
  points.forEach(p => {
    p.px = x(p.t)
    p.py = y(p.y)
  })
  ctx.fillStyle = '#555'
  ctx.fillText(niceNum(maxY), 8, pad.t + 6)
  ctx.fillText(niceNum(minY), 8, pad.t + ph)
  const zy = y(0)
  ctx.strokeStyle = '#666'
  ctx.beginPath(); ctx.moveTo(pad.l, zy); ctx.lineTo(w - pad.r, zy); ctx.stroke()
  ctx.fillStyle = '#777'
  ctx.fillText('0', 8, zy + 4)
  ctx.strokeStyle = def.mode === 'balance' ? '#ffdd33' : '#00cccc'
  ctx.lineWidth = 2
  ctx.beginPath()
  points.forEach((p, i) => {
    const px = x(p.t), py = y(p.y)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()
  points.forEach(p => {
    ctx.fillStyle = p.delta < 0 ? '#cc3333' : '#33cc33'
    ctx.beginPath(); ctx.arc(p.px, p.py, 3, 0, Math.PI * 2); ctx.fill()
  })
  const active = hover?.id === def.id ? nearestPoint(points) : null
  if (active) {
    ctx.strokeStyle = '#777'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(active.px, pad.t); ctx.lineTo(active.px, pad.t + ph); ctx.stroke()
    ctx.fillStyle = '#101010'
    ctx.strokeStyle = '#ffdd33'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(active.px, active.py, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    renderTip(active, canvas)
  }
}
async function refreshCharts() {
  const from = inputDate('from') || new Date(Date.now() - 86400000)
  const to = inputDate('to') || new Date()
  const qs = '?from=' + encodeURIComponent(from.toISOString()) + '&to=' + encodeURIComponent(to.toISOString())
  const events = await fetch('/balance-events' + qs).then(r => r.json())
  latestEvents = events.events || []
  latestFrom = from
  latestTo = to
  redrawCharts()
}
async function refresh() {
  try {
    const d = await fetch('/stats').then(r => r.json())
    const p = d.player
    document.getElementById('root').innerHTML =
      row('User:', esc(p.username) || '&mdash;', 'yellow') +
      row('Potatoes:', fmt(p.potatoes), p.potatoes < 0 ? 'red' : 'green') +
      row('Prestige:', fmt(p.prestige)) +
      row('Farm:', esc(p.farmSize) || '&mdash;') +
      row('Rank:', '#' + fmt(p.leaderboardRank) + ' / ' + fmt(p.totalPlayers)) +
      row('Harvests:', fmt(p.harvests)) +
      row('Steals:', fmt(p.steals)) +
      row('Stolen From:', fmt(p.stolenFrom)) +
      sec('Session &nbsp; ' + dur(d.session.elapsedMs)) +
      statRows(d.session) +
      sec('Today') +
      statRows(d.today) +
      sec('Last 7 Days') +
      statRows(d.week) +
      sec('All Time') +
      statRows(d.allTime) +
      '<div class="bt">' +
      row('Last Command:', esc(p.lastCommand) || '&mdash;', 'yellow') +
      '</div>'
    document.getElementById('foot').textContent = 'updated ' + new Date().toLocaleTimeString()
  } catch(e) {
    document.getElementById('foot').textContent = 'error: ' + String(e)
  }
}
document.getElementById('range24').addEventListener('click', () => setRange(24))
document.getElementById('range7').addEventListener('click', () => setRange(24 * 7))
document.getElementById('apply').addEventListener('click', refreshCharts)
chartDefs.forEach(def => {
  const canvas = document.getElementById(def.id)
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect()
    hover = { id: def.id, x: e.clientX - rect.left, y: e.clientY - rect.top }
    redrawCharts()
  })
  canvas.addEventListener('mouseleave', () => {
    hover = null
    redrawCharts()
  })
})
window.addEventListener('resize', redrawCharts)
setRange(24)
refresh()
setInterval(refresh, 1000)
setInterval(refreshCharts, 15000)
</script>
</body>
</html>`;

const HTML_BUF = Buffer.from(HTML);
const HTML_HEADERS: OutgoingHttpHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Length": HTML_BUF.length,
};

export function startServer(): Server {
  const server = createServer((req, res) => {
    const reqUrl = new URL(req.url ?? "/", "http://localhost");
    const url = reqUrl.pathname;

    if (req.method === "GET" && url === "/") {
      res.writeHead(200, HTML_HEADERS);
      res.end(HTML_BUF);
      return;
    }

    if (req.method === "GET" && url === "/stats") {
      const body = JSON.stringify({
        player: playerInfo,
        session: { elapsedMs: Date.now() - sessionStart, ...sessionTotals },
        today: cache.today,
        week: cache.week,
        allTime: cache.totals,
      });
      res.writeHead(200, JSON_HEADERS);
      res.end(body);
      return;
    }

    if (req.method === "GET" && url === "/balance-events") {
      const now = Date.now();
      const fromParam = reqUrl.searchParams.get("from");
      const toParam = reqUrl.searchParams.get("to");
      const fromMs = fromParam ? Date.parse(fromParam) : now - 86400000;
      const toMs = toParam ? Date.parse(toParam) : now;
      const from = new Date(Number.isNaN(fromMs) ? now - 86400000 : fromMs);
      const to = new Date(Number.isNaN(toMs) ? now : toMs);
      const body = JSON.stringify({
        events: getBalanceEvents(from.toISOString(), to.toISOString()),
      });
      res.writeHead(200, JSON_HEADERS);
      res.end(body);
      return;
    }

    res.writeHead(404, JSON_HEADERS);
    res.end('{"error":"not found"}');
  });

  server.on("error", (err: Error) => {
    process.stderr.write(`http server error: ${String(err)}\n`);
  });

  server.listen(WEB_PORT);
  return server;
}
