export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.ico" type="image/png">
<title>Potat Farmer</title>
<style>
:root { color-scheme:dark; --bg:#090b0c; --panel:#0f1214; --panel2:#131719; --line:#273036; --muted:#77838a; --text:#d5dcdf; --yellow:#ffda44; --cyan:#2dd4d1; --green:#4ade80; --red:#fb7185 }
* { margin:0; padding:0; box-sizing:border-box }
body { background:var(--bg); color:var(--text); font:13px/1.55 'Courier New',monospace; padding:18px }
button,input,select { font:inherit }
button:focus-visible,input:focus-visible,select:focus-visible { outline:2px solid var(--cyan); outline-offset:2px }
#page { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:16px; max-width:1720px; margin:0 auto }
#charts,#box { min-width:0; border:1px solid var(--line); background:var(--panel); align-self:start }
#charts { position:relative }
.hdr { display:flex; align-items:center; justify-content:space-between; min-height:44px; padding:8px 12px; color:var(--yellow); font-weight:bold; border-bottom:1px solid var(--line); letter-spacing:1.6px }
.hdr small { color:var(--muted); font-weight:normal; letter-spacing:0 }
.toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:end; padding:10px 12px; border-bottom:1px solid var(--line); background:#0c0f10 }
.toolbar label { color:var(--muted); display:grid; gap:3px; font-size:11px; text-transform:uppercase; letter-spacing:.6px }
.toolbar input,.toolbar select,.toolbar button,.chart-action { background:#111618; color:var(--text); border:1px solid #354047; padding:6px 9px; min-height:32px }
.toolbar button,.chart-action { color:var(--yellow); cursor:pointer }
.toolbar button:hover,.chart-action:hover,.toolbar button.active { background:#222a2d; border-color:#64737b }
.toolbar button:disabled { color:#4f5a60; cursor:not-allowed; background:#0d1112; border-color:#273036 }
.toolbar .divider { width:1px; height:28px; margin:0 2px; background:var(--line) }
.hint { margin-left:auto; color:var(--muted); font-size:11px; align-self:center }
.kpis { display:grid; grid-template-columns:repeat(6,minmax(100px,1fr)); border-bottom:1px solid var(--line) }
.kpi { padding:10px 12px; min-width:0; border-right:1px solid var(--line) }
.kpi:last-child { border-right:0 }
.kpi-label { color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:.8px; white-space:nowrap }
.kpi-value { margin-top:2px; color:#fff; font-size:18px; line-height:1.25; overflow:hidden; text-overflow:ellipsis }
.kpi-note { color:var(--muted); font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px }
.plot { border:1px solid var(--line); min-width:0; background:var(--panel2); position:relative; overflow:hidden }
.plot-wide { grid-column:1 / -1 }
.plot-head { display:flex; justify-content:space-between; align-items:center; min-height:39px; padding:5px 7px 5px 11px; border-bottom:1px solid var(--line) }
.plot-title { color:var(--cyan); font-size:13px; font-weight:bold }
.plot-meta { color:var(--muted); font-size:10px; margin-left:7px }
.legend { display:inline-flex; flex-wrap:wrap; gap:7px; margin-left:10px; color:var(--muted); font-size:10px; font-weight:normal }
.legend i { display:inline-block; width:8px; height:8px; margin-right:3px; border-radius:50% }
.plot-tools { display:flex; gap:5px }
.chart-action { min-height:26px; padding:3px 7px; color:var(--muted); font-size:11px }
.plot canvas { display:block; width:100%; height:300px; cursor:crosshair; touch-action:none }
.plot.expanded { position:fixed; inset:16px; z-index:20; box-shadow:0 18px 80px #000; border-color:#516169 }
.plot.expanded canvas { height:calc(100vh - 72px) }
body.modal-open { overflow:hidden }
#selection { position:absolute; z-index:3; top:39px; bottom:0; background:rgba(45,212,209,.12); border-left:1px solid var(--cyan); border-right:1px solid var(--cyan); pointer-events:none }
#chartLoading { position:absolute; inset:0; z-index:15; display:flex; align-items:center; justify-content:center; gap:10px; background:rgba(9,11,12,.72); color:var(--yellow); font-weight:bold; letter-spacing:.8px; cursor:wait; backdrop-filter:blur(1px) }
#chartLoading[hidden] { display:none }
.spinner { width:20px; height:20px; border:2px solid #48545a; border-top-color:var(--yellow); border-radius:50%; animation:spin .7s linear infinite }
@keyframes spin { to { transform:rotate(360deg) } }
.sec { padding:5px 0; border-top:1px solid var(--line); color:var(--cyan); font-weight:bold; text-align:center; background:#0c0f10 }
.row { display:flex; justify-content:space-between; gap:12px; padding:2px 14px }
.row > :last-child { text-align:right }
.lbl { color:var(--muted) }
.bt { border-top:1px solid var(--line) }
.green { color:var(--green) } .red { color:var(--red) } .cyan { color:var(--cyan) }
.yellow { color:var(--yellow) } .dim { color:#566168 }
#foot { text-align:center; color:#59646a; font-size:11px; margin-top:8px }
#tip { position:fixed; z-index:30; pointer-events:none; min-width:205px; max-width:300px; background:#050607; border:1px solid #617078; color:var(--text); padding:8px 10px; box-shadow:0 8px 30px #000; font-size:12px; line-height:1.5 }
#tip .t { color:var(--yellow); font-weight:bold; margin-bottom:3px }
#tip .k { color:var(--muted) }
#eventModal { position:fixed; inset:0; z-index:40; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(0,0,0,.78) }
#eventModal[hidden] { display:none }
.event-card { width:min(620px,100%); max-height:85vh; overflow:auto; border:1px solid #617078; background:#0d1113; box-shadow:0 20px 80px #000 }
.event-head { display:flex; align-items:center; justify-content:space-between; padding:10px 13px; border-bottom:1px solid var(--line); color:var(--yellow); font-weight:bold }
.event-close { border:1px solid #354047; background:#111618; color:var(--text); padding:3px 8px; cursor:pointer }
.event-body { padding:12px 14px }
.event-response { margin-top:10px; padding:10px; border:1px solid var(--line); background:#080a0b; color:#b9c3c7; white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.5 'Courier New',monospace }
@media (max-width:1250px) { .kpis { grid-template-columns:repeat(3,1fr) } .kpi:nth-child(3) { border-right:0 } .kpi:nth-child(-n+3) { border-bottom:1px solid var(--line) } }
@media (max-width:1050px) { #page { grid-template-columns:1fr } #box { order:-1 } }
@media (max-width:760px) { body { padding:8px } .grid { grid-template-columns:1fr; padding:8px } .plot-wide { grid-column:auto } .kpis { grid-template-columns:repeat(2,1fr) } .kpi { border-bottom:1px solid var(--line) !important } .kpi:nth-child(even) { border-right:0 } .plot canvas { height:260px } .hint { width:100%; margin-left:0 } .plot.expanded { inset:4px } }
</style>
</head>
<body>
<div id="page">
  <main id="charts">
    <div class="hdr"><span>ANALYTICS</span><small id="windowLabel">Selected window</small></div>
    <div class="toolbar">
      <label>From <input id="from" type="datetime-local"></label>
      <label>To <input id="to" type="datetime-local"></label>
      <button data-range="1" type="button">1h</button>
      <button data-range="4" type="button">4h</button>
      <button data-range="24" type="button">24h</button>
      <button data-range="168" type="button">7d</button>
      <button data-range="720" type="button">30d</button>
      <button data-range="2160" type="button">90d</button>
      <button data-range="8760" type="button">1y</button>
      <button data-range="all" type="button">All</button>
      <button id="apply" type="button">Apply</button>
      <span class="divider"></span>
      <button id="resetZoom" type="button" disabled>Reset zoom</button>
      <label>Event <select id="categoryFilter"><option value="all">All types</option><option value="harvest">Harvest</option><option value="steal">Steal</option><option value="spending">Spending</option><option value="quiz">Quiz reward</option><option value="quiz_failure">Quiz failure</option><option value="rankup">Rank up</option><option value="prestige">Prestige</option><option value="other">Other</option></select></label>
      <label>Impact <select id="impactFilter"><option value="all">Any impact</option><option value="gain">Gains</option><option value="loss">Losses</option><option value="neutral">No change</option></select></label>
      <span class="hint">Drag zoom · wheel zoom · Shift+drag pan</span>
    </div>
    <section class="kpis" id="kpis" aria-label="Selected window metrics"></section>
    <div class="grid">
      <section class="plot plot-wide" data-chart="overview"><div class="plot-head"><div><span class="plot-title">Balance &amp; Activity</span><span class="plot-meta" id="overviewMeta"></span><span class="legend"><span><i style="background:#4ade80"></i>Harvest</span><span><i style="background:#38bdf8"></i>Steal</span><span><i style="background:#fb7185"></i>Spend</span><span><i style="background:#c084fc"></i>Quiz</span><span><i style="background:#ef4444"></i>Quiz fail</span><span><i style="background:#fb923c"></i>Rank</span><span><i style="background:#ffda44"></i>Prestige</span></span></div><div class="plot-tools"><button class="chart-action" data-expand="overview" type="button" aria-label="Expand Balance and Activity">Expand</button></div></div><canvas id="overview"></canvas></section>
      <section class="plot" data-chart="steal"><div class="plot-head"><div><span class="plot-title">Steal P&amp;L</span><span class="plot-meta" id="stealMeta"></span></div><div class="plot-tools"><button class="chart-action" data-expand="steal" type="button" aria-label="Expand Steal P&amp;L">Expand</button></div></div><canvas id="steal"></canvas></section>
      <section class="plot" data-chart="harvest"><div class="plot-head"><div><span class="plot-title">Harvest Yield</span><span class="plot-meta" id="harvestMeta"></span></div><div class="plot-tools"><button class="chart-action" data-expand="harvest" type="button" aria-label="Expand Harvest Yield">Expand</button></div></div><canvas id="harvest"></canvas></section>
      <section class="plot" data-chart="spending"><div class="plot-head"><div><span class="plot-title">Spending</span><span class="plot-meta" id="spendingMeta"></span></div><div class="plot-tools"><button class="chart-action" data-expand="spending" type="button" aria-label="Expand Spending">Expand</button></div></div><canvas id="spending"></canvas></section>
      <section class="plot" data-chart="quiz"><div class="plot-head"><div><span class="plot-title">Quiz Outcomes</span><span class="plot-meta" id="quizMeta"></span></div><div class="plot-tools"><button class="chart-action" data-expand="quiz" type="button" aria-label="Expand Quiz Outcomes">Expand</button></div></div><canvas id="quiz"></canvas></section>
    </div>
    <div id="chartLoading" role="status" aria-live="polite" hidden><span class="spinner" aria-hidden="true"></span><span>Loading analytics&hellip;</span></div>
  </main>
  <aside id="box">
    <div class="hdr"><span>STATS</span><small>live</small></div>
    <div id="root">Loading&hellip;</div>
  </aside>
</div>
<div id="foot"></div>
<div id="tip" hidden></div>
<div id="eventModal" role="dialog" aria-modal="true" aria-labelledby="eventTitle" hidden><article class="event-card"><header class="event-head"><span id="eventTitle">Event details</span><button id="eventClose" class="event-close" type="button" aria-label="Close event details">Close</button></header><div id="eventBody" class="event-body"></div></article></div>
<script>
const _esc = document.createElement('span')
function esc(s) { _esc.textContent = String(s || ''); return _esc.innerHTML }
function fmt(n, digits) { return Number(n).toLocaleString(undefined, digits === undefined ? {} : { maximumFractionDigits: digits }) }
function signed(n) { return n > 0 ? '+' + fmt(n) : n < 0 ? '-' + fmt(-n) : '0' }
function pct(s, a) { return a ? fmt(s / a * 100, 1) + '%' : '0%' }
function cls(n) { return n > 0 ? 'green' : n < 0 ? 'red' : 'dim' }
function row(lbl, val, c) { return '<div class="row"><span class="lbl">' + lbl + '</span><span' + (c ? ' class="' + c + '"' : '') + '>' + val + '</span></div>' }
function sec(label) { return '<div class="sec">' + label + '</div>' }
function statRows(s) {
  let out = ''
  if (s.farmAttempts > 0) out += row('Farm:', fmt(s.farmSuccesses) + ' / ' + fmt(s.farmAttempts) + ' (' + pct(s.farmSuccesses, s.farmAttempts) + ')&nbsp; <span class="' + cls(s.farm) + '">' + signed(s.farm) + '</span>')
  if (s.stealAttempts > 0) out += row('Steal:', fmt(s.stealSuccesses) + ' / ' + fmt(s.stealAttempts) + ' (' + pct(s.stealSuccesses, s.stealAttempts) + ')&nbsp; <span class="' + cls(s.steal) + '">' + signed(s.steal) + '</span>')
  if (s.rankups > 0) out += row('Rank Ups:', fmt(s.rankups), 'cyan')
  if (s.prestiges > 0) out += row('Prestiges:', fmt(s.prestiges), 'cyan')
  if (s.quizAttempts > 0) {
    out += row('Quizzes:', fmt(s.quizSuccesses) + ' / ' + fmt(s.quizAttempts) + ' (' + pct(s.quizSuccesses, s.quizAttempts) + ')&nbsp; <span class="' + cls(s.quizReward) + '">' + signed(s.quizReward) + '</span>')
    out += row('Quiz Outcomes:', fmt(s.quizSuccesses) + ' correct, ' + fmt(s.quizFailures) + ' failed')
  }
  if (s.quizAnswerAttempts > 0) out += row('Quiz Answers:', fmt(s.quizAnswerAttempts) + ' (' + fmt(s.quizIncorrectAnswers) + ' incorrect, ' + fmt(s.quizCacheHits) + ' cached, ' + fmt(s.quizApiCalls) + ' API)')
  const total = s.farm + s.steal + s.quizReward
  if (total !== 0) out += row('Total:', signed(total), cls(total))
  return out || row('', '&mdash;', 'dim')
}
function dur(ms) {
  const t = Math.floor(ms / 1000), d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  if (d > 0) return d + 'd ' + h + 'h'
  if (h > 0) return h + 'h ' + m + 'm'
  if (m > 0) return m + 'm ' + s + 's'
  return s + 's'
}
const timeFmt = new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit' })
const dateFmt = new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short' })
const chartDefs = [
  { id:'overview', filter:e => true, mode:'balance', style:'line', color:'#ffda44' },
  { id:'steal', filter:e => e.category === 'steal', mode:'delta', style:'bar', color:'#2dd4d1' },
  { id:'harvest', filter:e => e.category === 'harvest', mode:'delta', style:'bar', color:'#2dd4d1' },
  { id:'spending', filter:e => e.category === 'spending', mode:'delta', style:'bar', color:'#2dd4d1' },
  { id:'quiz', filter:e => e.category === 'quiz' || e.category === 'quiz_failure', mode:'delta', style:'bar', color:'#2dd4d1' },
]
const chartPad = { l:62, r:18, t:20, b:38 }
const MIN_WINDOW_MS = 10000
let latestEvents = []
let queryFrom = new Date(Date.now() - 86400000)
let queryTo = new Date()
let viewFrom = new Date(queryFrom)
let viewTo = new Date(queryTo)
let resetFrom = new Date(queryFrom)
let resetTo = new Date(queryTo)
let liveRangeHours = 24
let autoFitData = false
let hover = null
let pinned = null
let drag = null
let expandedId = null
let chartFrame = 0
let hoverFrame = 0
let suppressClick = false
let eventsController = null
let requestSequence = 0
let analyticsLoading = false
const renderedPoints = {}
function localInputValue(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
function updateRangeInputs(hours) {
  const to = new Date(), from = hours === 'all' ? new Date(0) : new Date(to.getTime() - hours * 3600000)
  document.getElementById('from').value = localInputValue(from)
  document.getElementById('to').value = localInputValue(to)
}
function inputDate(id) { const v = document.getElementById(id).value; return v ? new Date(v) : null }
function niceNum(n) {
  if (Math.abs(n) >= 1000000000) return (n / 1000000000).toFixed(1).replace(/[.]0$/, '') + 'b'
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(/[.]0$/, '') + 'm'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/[.]0$/, '') + 'k'
  return String(Math.round(n))
}
function eventMatchesFilters(e) {
  const category=document.getElementById('categoryFilter').value,impact=document.getElementById('impactFilter').value
  return (category==='all'||e.category===category) && (impact==='all'||(impact==='gain'&&e.delta>0)||(impact==='loss'&&e.delta<0)||(impact==='neutral'&&e.delta===0))
}
function visibleEvents() { const a=viewFrom.getTime(),b=viewTo.getTime();return latestEvents.filter(e=>{const t=Date.parse(e.executedAt);return t>=a&&t<=b&&eventMatchesFilters(e)}) }
function rangeLabel(from, to) {
  const span = to.getTime() - from.getTime()
  if (span < 86400000) return timeFmt.format(from) + ' – ' + timeFmt.format(to)
  return dateFmt.format(from) + ' – ' + dateFmt.format(to)
}
function kpi(label, value, note, c) { return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value ' + (c || '') + '">' + value + '</div><div class="kpi-note">' + note + '</div></div>' }
function updateAnalytics() {
  const events = visibleEvents(), transactions = events.filter(e => e.category !== 'rankup' && e.category !== 'prestige' && e.category !== 'quiz_failure'), deltas = transactions.map(e => e.delta), net = deltas.reduce((a,b) => a + b, 0)
  const gains = deltas.filter(n => n > 0), losses = deltas.filter(n => n < 0), positive = gains.length
  const avg = transactions.length ? net / transactions.length : 0
  const best = gains.reduce((largest,n) => Math.max(largest,n),0), worst = losses.reduce((smallest,n) => Math.min(smallest,n),0)
  document.getElementById('windowLabel').textContent = rangeLabel(viewFrom, viewTo)
  document.getElementById('kpis').innerHTML =
    kpi('Net change', signed(net), 'selected window', cls(net)) +
    kpi('Transactions', fmt(transactions.length), dur(viewTo - viewFrom), '') +
    kpi('Positive rate', pct(positive, transactions.length), fmt(positive) + ' gains / ' + fmt(losses.length) + ' losses', positive >= losses.length ? 'green' : 'red') +
    kpi('Average / event', signed(avg), 'net ÷ transactions', cls(avg)) +
    kpi('Largest gain', signed(best), gains.length ? 'best transaction' : 'no gains', 'green') +
    kpi('Largest loss', signed(worst), losses.length ? 'worst transaction' : 'no losses', losses.length ? 'red' : 'dim')
  chartDefs.forEach(def => {
    const series = events.filter(def.filter), total = series.reduce((sum,e) => sum + e.delta, 0)
    document.getElementById(def.id + 'Meta').textContent = fmt(series.length) + ' events · ' + signed(total)
  })
  const zoomed = viewFrom.getTime() !== resetFrom.getTime() || viewTo.getTime() !== resetTo.getTime()
  document.getElementById('resetZoom').disabled = !zoomed
}
function hideTip() { document.getElementById('tip').hidden = true }
function setLoading(value) {
  analyticsLoading=value
  document.getElementById('chartLoading').hidden=!value
  document.querySelectorAll('.toolbar button:not(#resetZoom),.toolbar input,.toolbar select').forEach(control=>{control.disabled=value})
  if(value)document.getElementById('resetZoom').disabled=true
  document.getElementById('charts').setAttribute('aria-busy',String(value))
}
function categoryLabel(category) {
  return { harvest:'Harvest', steal:'Steal', spending:'Spending', quiz:'Quiz reward', quiz_failure:'Quiz failure', rankup:'Rank up', prestige:'Prestige', other:'Other' }[category] || category
}
function eventColor(category) {
  return { harvest:'#4ade80', steal:'#38bdf8', spending:'#fb7185', quiz:'#c084fc', quiz_failure:'#ef4444', rankup:'#fb923c', prestige:'#ffda44' }[category] || '#94a3b8'
}
function renderTip(point, canvas) {
  const tip = document.getElementById('tip'), changeClass = cls(point.delta)
  tip.innerHTML = '<div class="t">' + esc(dateTimeFmt.format(new Date(point.executedAt))) + '</div>' +
    '<div><span class="k">Command:</span> ' + esc(point.command) + '</div>' +
    '<div><span class="k">Event:</span> ' + esc(categoryLabel(point.category)) + '</div>' +
    '<div><span class="k">Change:</span> <span class="' + changeClass + '">' + signed(point.delta) + '</span></div>' +
    '<div><span class="k">Balance after:</span> ' + fmt(point.balanceAfter) + '</div>'
  tip.hidden = false
  const rect = canvas.getBoundingClientRect(), tr = tip.getBoundingClientRect()
  let left = rect.left + point.px + 14, top = rect.top + point.py - tr.height - 14
  if (left + tr.width > window.innerWidth - 8) left = rect.left + point.px - tr.width - 14
  if (top < 8) top = rect.top + point.py + 14
  tip.style.left = Math.max(8,left) + 'px'; tip.style.top = Math.min(window.innerHeight - tr.height - 8,Math.max(8,top)) + 'px'
}
function closeEvent() { document.getElementById('eventModal').hidden=true }
async function openEvent(point) {
  const modal=document.getElementById('eventModal'),body=document.getElementById('eventBody')
  modal.hidden=false;body.innerHTML='<span class="dim">Loading event details&hellip;</span>'
  try {
    const response=await fetch('/events/'+encodeURIComponent(point.id))
    if(!response.ok)throw new Error('event request failed ('+response.status+')')
    const detail=(await response.json()).event
    body.innerHTML=
      row('Time:',esc(dateTimeFmt.format(new Date(detail.executedAt))))+
      row('Type:',esc(categoryLabel(detail.category)))+
      row('Command:',esc(detail.command),'yellow')+
      row('Balance change:',signed(detail.delta),cls(detail.delta))+
      row('Balance after:',fmt(detail.balanceAfter))+
      '<div class="sec">Stored response</div><pre class="event-response">'+esc(detail.responseText||'No response text stored')+'</pre>'
  } catch(e) { body.innerHTML='<span class="red">'+esc(String(e))+'</span>' }
}
function nearestPoint(points, target) {
  if (!target || !points.length) return null
  let best = null, bestDist = Infinity
  points.forEach(p => {
    const dx = p.px - target.x, dy = p.py - target.y, dist = p.barW ? Math.abs(dx) : Math.sqrt(dx * dx + dy * dy)
    const barHit = p.barW && target.x >= p.barX - 4 && target.x <= p.barX + p.barW + 4 && target.y >= p.barY - 4 && target.y <= p.barY + p.barH + 4
    if ((barHit || dist < bestDist) && (!p.barW || barHit)) { best = p; bestDist = dist }
  })
  return best && (best.barW || bestDist <= 14) ? best : null
}
function queueRedraw() {
  cancelAnimationFrame(hoverFrame)
  cancelAnimationFrame(chartFrame)
  chartFrame = requestAnimationFrame(redrawCharts)
}
function queueChartRedraw(id) {
  cancelAnimationFrame(hoverFrame)
  hoverFrame=requestAnimationFrame(()=>{hideTip();const def=chartDefs.find(item=>item.id===id);if(def)drawChart(def,visibleEvents(),viewFrom,viewTo)})
}
function redrawCharts() {
  hideTip(); updateAnalytics()
  const events = visibleEvents()
  chartDefs.forEach(def => drawChart(def, events, viewFrom, viewTo))
}
function drawChart(def, events, from, to) {
  const canvas = document.getElementById(def.id), rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1,Math.floor(rect.width * dpr)); canvas.height = Math.max(1,Math.floor(rect.height * dpr))
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0)
  const w = rect.width, h = rect.height, pad = chartPad, pw = Math.max(1,w-pad.l-pad.r), ph = Math.max(1,h-pad.t-pad.b)
  ctx.fillStyle = '#131719'; ctx.fillRect(0,0,w,h)
  const start = from.getTime(), end = to.getTime()
  function x(t) { return pad.l + ((t-start) / Math.max(1,end-start)) * pw }
  const points = events.filter(def.filter).map(e => ({ id:e.id, t:Date.parse(e.executedAt), y:def.mode === 'balance' ? e.balanceAfter : e.delta, delta:e.delta, balanceAfter:e.balanceAfter, command:e.command, category:e.category, executedAt:e.executedAt }))
  let minY, maxY
  if (points.length) { minY = points.reduce((smallest,p) => Math.min(smallest,p.y),points[0].y); maxY = points.reduce((largest,p) => Math.max(largest,p.y),points[0].y) } else { minY = -1; maxY = 1 }
  if (def.mode === 'delta') { minY = Math.min(minY,0); maxY = Math.max(maxY,0) }
  if (minY === maxY) { const spread = Math.max(1,Math.abs(minY) * .05); minY -= spread; maxY += spread }
  const yPad = (maxY-minY) * .1; minY -= yPad; maxY += yPad
  function y(v) { return pad.t + (1-(v-minY)/(maxY-minY))*ph }
  ctx.font = '11px Courier New'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 1
  for (let i=0;i<=4;i++) {
    const gy = pad.t + ph*i/4, value = maxY-(maxY-minY)*i/4
    ctx.strokeStyle = '#273036'; ctx.beginPath(); ctx.moveTo(pad.l,gy); ctx.lineTo(w-pad.r,gy); ctx.stroke()
    ctx.fillStyle = '#77838a'; ctx.textAlign = 'right'; ctx.fillText(niceNum(value),pad.l-8,gy+4)
  }
  const ticks = w < 500 ? 3 : 5
  for (let i=0;i<ticks;i++) {
    const tx = pad.l + pw*i/(ticks-1), stamp = start+(end-start)*i/(ticks-1), label = end-start > 86400000 ? dateFmt.format(new Date(stamp)) : timeFmt.format(new Date(stamp))
    ctx.fillStyle = '#77838a'; ctx.textAlign = i===0 ? 'left' : i===ticks-1 ? 'right' : 'center'; ctx.fillText(label,tx,h-12)
  }
  ctx.textAlign = 'left'
  if (!points.length) { ctx.fillStyle='#657178'; ctx.textAlign='center'; ctx.fillText('No transactions in this window',w/2,h/2); return }
  points.forEach(p => { p.px=x(p.t); p.py=y(p.y) })
  const stride=def.style==='line'?Math.max(1,Math.ceil(points.length/Math.max(1,pw*2))):1,displayPoints=stride===1?points:points.filter((p,i)=>i%stride===0||i===points.length-1)
  renderedPoints[def.id] = displayPoints
  const zeroY = y(0)
  if (zeroY >= pad.t && zeroY <= pad.t+ph) { ctx.strokeStyle='#69777e'; ctx.beginPath(); ctx.moveTo(pad.l,zeroY); ctx.lineTo(w-pad.r,zeroY); ctx.stroke() }
  ctx.save(); ctx.beginPath(); ctx.rect(pad.l,pad.t,pw,ph); ctx.clip()
  if (def.style === 'bar') {
    const bw = Math.max(3,Math.min(20,pw/Math.max(points.length*1.5,16)))
    points.forEach(p => { const marker=p.category==='quiz_failure',top=marker?zeroY-3:Math.min(p.py,zeroY),height=marker?6:Math.max(1,Math.abs(p.py-zeroY));p.barX=p.px-bw/2;p.barY=top;p.barW=bw;p.barH=height;ctx.fillStyle=marker?eventColor(p.category):p.delta<0?'#fb7185':'#4ade80';ctx.globalAlpha=.82;ctx.fillRect(p.barX,p.barY,bw,height) })
    ctx.globalAlpha=1
  } else {
    const gradient=ctx.createLinearGradient(0,pad.t,0,pad.t+ph); gradient.addColorStop(0,'rgba(255,218,68,.2)'); gradient.addColorStop(1,'rgba(255,218,68,0)')
    ctx.beginPath(); displayPoints.forEach((p,i) => { if(i===0)ctx.moveTo(p.px,p.py);else ctx.lineTo(p.px,p.py) }); ctx.lineTo(displayPoints[displayPoints.length-1].px,pad.t+ph); ctx.lineTo(displayPoints[0].px,pad.t+ph); ctx.closePath(); ctx.fillStyle=gradient; ctx.fill()
    ctx.beginPath(); displayPoints.forEach((p,i) => { if(i===0)ctx.moveTo(p.px,p.py);else ctx.lineTo(p.px,p.py) }); ctx.strokeStyle=def.color; ctx.lineWidth=2; ctx.stroke()
    displayPoints.forEach(p => { ctx.fillStyle=eventColor(p.category);ctx.beginPath();ctx.arc(p.px,p.py,p.category==='rankup'||p.category==='prestige'?5:3.5,0,Math.PI*2);ctx.fill() })
  }
  const active = pinned && pinned.chartId===def.id ? displayPoints.find(p=>p.id===pinned.eventId) || null : hover && hover.id===def.id ? nearestPoint(displayPoints,hover) : null
  if (hover && hover.id===def.id) { ctx.strokeStyle='#849198'; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(hover.x,pad.t); ctx.lineTo(hover.x,pad.t+ph); ctx.stroke(); ctx.setLineDash([]) }
  if (active) { ctx.strokeStyle='#fff'; ctx.lineWidth=2; if(active.barW)ctx.strokeRect(active.barX-2,active.barY-2,active.barW+4,active.barH+4);else { ctx.fillStyle='#131719'; ctx.beginPath();ctx.arc(active.px,active.py,6,0,Math.PI*2);ctx.fill();ctx.stroke() } }
  ctx.restore()
  if (active) renderTip(active,canvas)
}
function clampView(a,b) {
  const q0=queryFrom.getTime(), q1=queryTo.getTime(), full=q1-q0, span=Math.max(MIN_WINDOW_MS,Math.min(full,b-a))
  let start=a, end=a+span
  if(start<q0){start=q0;end=q0+span} if(end>q1){end=q1;start=q1-span}
  viewFrom=new Date(start); viewTo=new Date(end); liveRangeHours=null; queueRedraw()
}
function resetZoom() { viewFrom=new Date(resetFrom); viewTo=new Date(resetTo); hover=null; pinned=null; drag=null; queueRedraw() }
async function refreshCharts(resetView,showLoading) {
  if (liveRangeHours !== null) updateRangeInputs(liveRangeHours)
  const from=inputDate('from') || new Date(Date.now()-86400000), to=inputDate('to') || new Date()
  if (from>=to) { document.getElementById('foot').textContent='The start time must be before the end time'; return }
  const qs='?from='+encodeURIComponent(from.toISOString())+'&to='+encodeURIComponent(to.toISOString())
  const requestId=++requestSequence
  let redrawOwnsLoading=false
  if(showLoading!==false)setLoading(true)
  try {
    if(eventsController)eventsController.abort();eventsController=new AbortController()
    const response=await fetch('/events'+qs,{signal:eventsController.signal})
    if(!response.ok)throw new Error('events request failed ('+response.status+')')
    const payload=await response.json(), wasAtDefault=viewFrom.getTime()===resetFrom.getTime() && viewTo.getTime()===resetTo.getTime()
    latestEvents=payload.events || []; queryFrom=from; queryTo=to
    if(autoFitData && latestEvents.length){
      const times=latestEvents.map(e=>Date.parse(e.executedAt)),first=times.reduce((a,b)=>Math.min(a,b)),last=times.reduce((a,b)=>Math.max(a,b)),dataSpan=Math.max(MIN_WINDOW_MS,last-first),padding=Math.max(60000,dataSpan*.02)
      resetFrom=new Date(Math.max(from.getTime(),first-padding));resetTo=new Date(Math.min(to.getTime(),last+padding))
      if(liveRangeHours==='all'){queryFrom=new Date(resetFrom);queryTo=new Date(resetTo)}
    } else { resetFrom=new Date(from);resetTo=new Date(to) }
    if(resetView || wasAtDefault || liveRangeHours!==null){viewFrom=new Date(resetFrom);viewTo=new Date(resetTo)}
    else clampView(viewFrom.getTime(),viewTo.getTime())
    if(showLoading===false)queueRedraw()
    else {
      redrawOwnsLoading=true;cancelAnimationFrame(hoverFrame);cancelAnimationFrame(chartFrame)
      chartFrame=requestAnimationFrame(()=>{redrawCharts();if(requestId===requestSequence)setLoading(false)})
    }
  } catch(e) { if(e.name!=='AbortError')document.getElementById('foot').textContent='error: '+String(e) }
  finally { if(requestId===requestSequence&&showLoading!==false&&!redrawOwnsLoading)setLoading(false) }
}
async function refresh() {
  try {
    const response=await fetch('/stats'); if(!response.ok)throw new Error('stats request failed ('+response.status+')')
    const d=await response.json(),p=d.player
    document.getElementById('root').innerHTML=
      row('User:',esc(p.username)||'&mdash;','yellow')+row('Potatoes:',fmt(p.potatoes),p.potatoes<0?'red':'green')+row('Prestige:',fmt(p.prestige))+row('Farm:',esc(p.farmSize)||'&mdash;')+
      row('Rank:','#'+fmt(p.leaderboardRank)+' / '+fmt(p.totalPlayers))+row('Harvests:',fmt(p.harvests))+row('Steals:',fmt(p.steals))+row('Stolen From:',fmt(p.stolenFrom))+
      sec('Session &nbsp; '+dur(d.session.elapsedMs))+statRows(d.session)+sec('Today')+statRows(d.today)+sec('Last 7 Days')+statRows(d.week)+sec('All Time')+statRows(d.allTime)+
      '<div class="bt">'+row('Last Command:',esc(p.lastCommand)||'&mdash;','yellow')+'</div>'
    document.getElementById('foot').textContent='updated '+new Date().toLocaleTimeString()
  } catch(e) { document.getElementById('foot').textContent='error: '+String(e) }
}
function toggleExpand(id) {
  const next=expandedId===id?null:id
  document.querySelectorAll('.plot').forEach(el=>el.classList.toggle('expanded',el.dataset.chart===next))
  document.querySelectorAll('[data-expand]').forEach(btn=>btn.textContent=btn.dataset.expand===next?'Close':'Expand')
  expandedId=next;document.body.classList.toggle('modal-open',Boolean(next));hover=null;pinned=null;queueRedraw()
}
document.querySelectorAll('[data-range]').forEach(btn=>btn.addEventListener('click',()=>{
  liveRangeHours=btn.dataset.range === 'all' ? 'all' : Number(btn.dataset.range);updateRangeInputs(liveRangeHours)
  autoFitData=liveRangeHours === 'all' || liveRangeHours >= 8760
  document.querySelectorAll('[data-range]').forEach(b=>b.classList.toggle('active',b===btn));refreshCharts(true)
}))
document.getElementById('from').addEventListener('input',()=>{liveRangeHours=null;autoFitData=false})
document.getElementById('to').addEventListener('input',()=>{liveRangeHours=null;autoFitData=false})
document.getElementById('apply').addEventListener('click',()=>{liveRangeHours=null;autoFitData=false;refreshCharts(true)})
document.getElementById('resetZoom').addEventListener('click',resetZoom)
document.querySelectorAll('#categoryFilter,#impactFilter').forEach(el=>el.addEventListener('change',()=>{setLoading(true);pinned=null;hover=null;requestAnimationFrame(()=>requestAnimationFrame(()=>{redrawCharts();setLoading(false)}))}))
document.querySelectorAll('[data-expand]').forEach(btn=>btn.addEventListener('click',()=>toggleExpand(btn.dataset.expand)))
chartDefs.forEach(def=>{
  const canvas=document.getElementById(def.id)
  function position(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,width:r.width}}
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=position(e);drag={id:def.id,startX:p.x,lastX:p.x,pan:e.shiftKey,from:viewFrom.getTime(),to:viewTo.getTime()};canvas.setPointerCapture(e.pointerId);hideTip()})
  canvas.addEventListener('pointermove',e=>{
    const p=position(e)
    if(drag&&drag.id===def.id){
      if(drag.pan){const dx=p.x-drag.lastX,span=viewTo-viewFrom;clampView(viewFrom.getTime()-dx/Math.max(1,p.width-chartPad.l-chartPad.r)*span,viewTo.getTime()-dx/Math.max(1,p.width-chartPad.l-chartPad.r)*span);drag.lastX=p.x}
      else {let sel=canvas.parentElement.querySelector('#selection');if(!sel){sel=document.createElement('div');sel.id='selection';canvas.parentElement.appendChild(sel)}sel.style.left=Math.min(drag.startX,p.x)+'px';sel.style.width=Math.abs(p.x-drag.startX)+'px'}
      return
    }
    const ratio=Math.max(0,Math.min(1,(p.x-chartPad.l)/Math.max(1,p.width-chartPad.l-chartPad.r)))
    hover={id:def.id,x:p.x,y:p.y,t:viewFrom.getTime()+(viewTo-viewFrom)*ratio};queueChartRedraw(def.id)
  })
  canvas.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==def.id)return
    const p=position(e),selection=document.getElementById('selection');if(selection)selection.remove()
    suppressClick=Math.abs(p.x-drag.startX)>5
    if(!drag.pan&&Math.abs(p.x-drag.startX)>8){const pw=Math.max(1,p.width-chartPad.l-chartPad.r),a=Math.max(0,Math.min(1,(drag.startX-chartPad.l)/pw)),b=Math.max(0,Math.min(1,(p.x-chartPad.l)/pw)),start=drag.from+(drag.to-drag.from)*Math.min(a,b),end=drag.from+(drag.to-drag.from)*Math.max(a,b);clampView(start,end)}
    drag=null
  })
  canvas.addEventListener('pointercancel',()=>{drag=null;const selection=document.getElementById('selection');if(selection)selection.remove()})
  canvas.addEventListener('mouseleave',()=>{if(!drag){hover=null;queueChartRedraw(def.id)}})
  canvas.addEventListener('wheel',e=>{e.preventDefault();const p=position(e),pw=Math.max(1,p.width-chartPad.l-chartPad.r),ratio=Math.max(0,Math.min(1,(p.x-chartPad.l)/pw)),start=viewFrom.getTime(),end=viewTo.getTime(),anchor=start+(end-start)*ratio,factor=e.deltaY>0?1.35:.72;clampView(anchor-(anchor-start)*factor,anchor+(end-anchor)*factor)},{passive:false})
  canvas.addEventListener('click',e=>{if(suppressClick){suppressClick=false;return}const p=position(e),point=nearestPoint(renderedPoints[def.id]||[],p);pinned=point?{chartId:def.id,eventId:point.id}:null;hover=point?{id:def.id,x:p.x,y:p.y}:null;queueChartRedraw(def.id);if(point)openEvent(point)})
  canvas.addEventListener('dblclick',resetZoom)
})
document.getElementById('eventClose').addEventListener('click',closeEvent)
document.getElementById('eventModal').addEventListener('click',e=>{if(e.target.id==='eventModal')closeEvent()})
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('eventModal').hidden)closeEvent();else if(e.key==='Escape'&&expandedId)toggleExpand(expandedId)})
window.addEventListener('resize',queueRedraw)
updateRangeInputs(24);document.querySelector('[data-range="24"]').classList.add('active')
refreshCharts(true);refresh();setInterval(refresh,1000);setInterval(()=>{if(!analyticsLoading)refreshCharts(false,false)},15000)
</script>
</body>
</html>`;
