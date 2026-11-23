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
function renderWeekDots(history, now){
  const start = weekStart(now), today = dateKey(now), done = new Set(history.map(h => h.date));
  const days = ['一','二','三','四','五','六','日'].map((n, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    return {n, d, k: dateKey(d)};
  });
  $('week-dots').innerHTML = days.map(({n, d, k}) =>
    `<span class="wd${done.has(k) ? ' on' : ''}${k === today ? ' today' : ''}" title="${d.getMonth()+1}/${d.getDate()}"><em>${n}</em><i>${d.getDate()}</i></span>`
  ).join('');
  const f = days[0].d, l = days[6].d;
  $('week-range').textContent = `　${f.getMonth()+1}/${f.getDate()} – ${l.getMonth()+1}/${l.getDate()}`;
}
function fmtElapsed(ms){
  const m = Math.floor(Math.max(0, ms) / 60000);
  if (m < 1) return '< 1 分';
  return m >= 60 ? `${Math.floor(m/60)} 時 ${m%60} 分` : `${m} 分`;
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
  list.innerHTML = exs.map(e =>
    `<a class="ex-card" href="record.html?part=${e.part}&name=${encodeURIComponent(e.name)}"><div><p class="ex-name">${e.name}</p><p class="ex-meta">${partName(e.part)}・${setsSummary(e.sets)}</p></div><span class="chev">›</span></a>`
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
  } else if (todayDone.length) {
    $('status-main').innerHTML = ICON.check + ' 今日訓練已完成';
    stats(Math.round(todayDone.reduce((n,h)=>n+(h.durationMs||0),0)/60000) + ' 分', todayDone.reduce((n,h)=>n+(h.exercises||[]).length,0));
  } else {
    $('status-main').textContent = '今天還沒開始訓練';
    $('stats').hidden = true;
  }
  $('week-count').textContent = weekDays(history, now);
  renderWeekDots(history, now);
  $('status-sub').textContent = active || todayDone.length ? '' : '從下方選擇今天要練的部位，記錄第一個動作就會開始計時';
  $('status-sub').hidden = !$('status-sub').textContent;
}

renderNav('home');
$('parts-grid').innerHTML = PARTS.map(p =>
  `<a class="part" href="part.html?part=${p.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${p.icon}</svg><span>${p.name}</span></a>`
).join('');

$('finish-btn').addEventListener('click', async () => {
  const active = load(KEY_ACTIVE, null); if (!active) return;
  const done = (active.exercises||[]).filter(e => e.sets && e.sets.length);
  const msg = done.length ? '結束今天的訓練並存入紀錄？' : '還沒有任何動作紀錄，確定結束並放棄這次訓練？';
  if (!(await confirmDialog(msg, done.length ? '完成訓練' : '放棄訓練'))) return;
  if (done.length) {
    addWorkout({date: dateKey(new Date(active.startedAt)), durationMs: Date.now() - new Date(active.startedAt), exercises: done});
  }
  clearActive();
  toast(done.length ? '今日訓練已存入紀錄' : '已放棄這次訓練');
  render(); renderCards();
});

render(); renderCards();
window.addEventListener('gym:synced', () => { render(); renderCards(); });
setInterval(render, 30000);
