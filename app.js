const $$ = s => document.querySelector(s);

function weekStart(d){
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // Monday
  return s;
}
function weekDays(history, now){
  const start = weekStart(now), end = new Date(start); end.setDate(end.getDate()+7);
  const days = new Set();
  for (const h of history) {
    const d = new Date(h.date + 'T00:00:00');
    if (d >= start && d < end) days.add(h.date);
  }
  return days.size;
}
function fmtElapsed(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600), m = Math.floor(s%3600/60);
  return h ? `${h}:${pad(m)}:${pad(s%60)}` : `${pad(m)}:${pad(s%60)}`;
}
const partName = id => PARTS.find(p => p.id === id)?.name || '';
function setsSummary(sets){
  if (!sets || !sets.length) return '尚未記錄';
  const best = sets.reduce((a,b) => (b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps)) ? b : a);
  return `${sets.length} 組・最佳 ${best.kg}kg × ${best.reps}`;
}

// Dashboard: header (state + time + count) is refreshed every second;
// the exercise cards are only redrawn when the data changes.
function renderCards(){
  const active = load(KEY_ACTIVE, null);
  const list = $('ex-cards');
  const exs = active?.exercises || [];
  list.hidden = !exs.length;
  list.innerHTML = exs.map((e, i) =>
    `<a class="ex-card" href="record.html?i=${i}"><div><p class="ex-name">${e.name}</p><p class="ex-meta">${partName(e.part)}・${setsSummary(e.sets)}</p></div><span class="chev">›</span></a>`
  ).join('');
}

function render(){
  const now = new Date();
  const wk = ['日','一','二','三','四','五','六'][now.getDay()];
  $('today-date').textContent = `${now.getFullYear()} 年 ${now.getMonth()+1} 月 ${now.getDate()} 日，星期${wk}`;

  const active = load(KEY_ACTIVE, null);
  const history = load(KEY_HISTORY, []);
  const todayDone = history.filter(h => h.date === dateKey(now));
  const card = $('status-card');
  card.classList.toggle('active', !!active);
  $('finish-btn').hidden = !active;

  const stats = (time, count) => {
    $('stat-time').textContent = time; $('stat-count').textContent = count;
    $('stats').hidden = false;
  };
  if (active) {
    $('status-main').textContent = '訓練進行中';
    stats(fmtElapsed(now - new Date(active.startedAt)), (active.exercises||[]).length);
    $('cta').textContent = '繼續訓練';
  } else if (todayDone.length) {
    $('status-main').textContent = '今日訓練已完成 ✅';
    stats(Math.round(todayDone.reduce((n,h)=>n+(h.durationMs||0),0)/60000) + ' 分', todayDone.reduce((n,h)=>n+(h.exercises||[]).length,0));
    $('cta').textContent = '開始訓練';
  } else {
    $('status-main').textContent = '今天還沒開始訓練';
    $('stats').hidden = true;
    $('cta').textContent = '開始訓練';
  }
  $('week-count').textContent = weekDays(history, now);
}

renderNav('home');
$('parts-grid').innerHTML = PARTS.map(p =>
  `<a class="part" href="part.html?part=${p.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${p.icon}</svg><span>${p.name}</span></a>`
).join('');

$('cta').addEventListener('click', () => {
  if (!load(KEY_ACTIVE, null)) save(KEY_ACTIVE, {startedAt: new Date().toISOString(), exercises: []});
  render(); renderCards();
  $('parts-section').scrollIntoView({behavior:'smooth'});
  const g = $('parts-grid'); g.classList.remove('pulse'); void g.offsetWidth; g.classList.add('pulse');
});

$('finish-btn').addEventListener('click', () => {
  const active = load(KEY_ACTIVE, null); if (!active) return;
  const done = (active.exercises||[]).filter(e => e.sets && e.sets.length);
  const msg = done.length ? '結束今天的訓練並存入紀錄？' : '還沒有任何動作紀錄，確定結束並放棄這次訓練？';
  if (!confirm(msg)) return;
  if (done.length) {
    const history = load(KEY_HISTORY, []);
    history.push({date: dateKey(new Date(active.startedAt)), durationMs: Date.now() - new Date(active.startedAt), exercises: done});
    save(KEY_HISTORY, history);
  }
  try { localStorage.removeItem(KEY_ACTIVE); } catch {}
  render(); renderCards();
});

render(); renderCards();
setInterval(render, 1000);
