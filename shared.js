const PARTS = [
  {id:'chest', name:'胸部', icon:'<path d="M3 9c3-3 6-3 9 0 3-3 6-3 9 0v4c-3 3-6 3-9 0-3 3-6 3-9 0z"/><path d="M12 9v4"/>'},
  {id:'back', name:'背部', icon:'<path d="M12 3v18"/><path d="M4 6l8 4 8-4"/><path d="M6 12l6 3 6-3"/>'},
  {id:'legs', name:'臀腿', icon:'<path d="M9 3h6l1 8-2 10h-3l-1-9-1 9H6l1-10z"/>'},
  {id:'shoulders', name:'肩部', icon:'<circle cx="12" cy="6" r="2.5"/><path d="M3 20c0-6 3-9 9-9s9 3 9 9"/>'},
  {id:'arms', name:'手臂', icon:'<path d="M6 18c0-6 3-11 8-11l4 3-3 3-3-1-2 6z"/>'},
  {id:'core', name:'核心', icon:'<rect x="7" y="3" width="10" height="18" rx="3"/><path d="M7 9h10M7 15h10M12 3v18"/>'}
];

const EXERCISES = {
  chest: ['槓鈴臥推','啞鈴臥推','上斜槓鈴臥推','上斜啞鈴臥推','下斜臥推','史密斯臥推','啞鈴飛鳥','繩索夾胸','蝴蝶機夾胸','器械胸推','伏地挺身','雙槓撐體'],
  back: ['引體向上','滑輪下拉','槓鈴划船','啞鈴單臂划船','坐姿划船','T 槓划船','直臂下拉','器械划船','硬舉','背部伸展'],
  legs: ['槓鈴深蹲','前蹲舉','哈克深蹲','腿推機','保加利亞分腿蹲','弓步蹲','羅馬尼亞硬舉','髖推','臀橋','腿屈伸','腿彎舉','髖外展機','小腿提踵'],
  shoulders: ['槓鈴肩推','啞鈴肩推','阿諾推舉','側平舉','前平舉','反向飛鳥','面拉','直立划船','聳肩'],
  arms: ['槓鈴彎舉','啞鈴彎舉','錘式彎舉','牧師椅彎舉','繩索彎舉','三頭肌下壓','過頭三頭伸展','仰臥臂屈伸','窄握臥推','窄距伏地挺身'],
  core: ['捲腹','棒式','側棒式','仰臥抬腿','懸垂舉腿','俄羅斯轉體','腹輪','登山者','繩索伐木','死蟲式']
};

const KEY_ACTIVE = 'gym.activeWorkout';
const KEY_FAV = 'gym.favorites';
const KEY_HISTORY = 'gym.history';
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function load(key, fallback){
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function save(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function renderNav(active){
  const items = [
    {id:'home', href:'index.html', label:'主頁', icon:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'},
    {id:'history', href:'history.html', label:'全年紀錄', icon:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'}
  ];
  const nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.innerHTML = items.map(i =>
    `<a href="${i.href}" class="${i.id===active?'on':''}"${i.id===active?' aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${i.icon}</svg><span>${i.label}</span></a>`
  ).join('');
  document.body.appendChild(nav);
  showPendingToast();
}

function toast(msg){
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2200);
}
// A page can leave a message for the next page, e.g. after saving.
function toastNext(msg){ try { sessionStorage.setItem('gym.toast', msg); } catch {} }
function showPendingToast(){
  try { const m = sessionStorage.getItem('gym.toast'); if (m) { sessionStorage.removeItem('gym.toast'); toast(m); } } catch {}
}

// In-page confirm dialog (native confirm() is blocked or ignored in some mobile browsers).
function confirmDialog(message, okLabel = '確定', cancelLabel = '取消'){
  return new Promise(resolve => {
    const o = document.createElement('div');
    o.className = 'dialog-bg';
    o.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true"><p></p><div class="dialog-btns"><button type="button" class="d-cancel"></button><button type="button" class="d-ok"></button></div></div>`;
    o.querySelector('p').textContent = message;
    o.querySelector('.d-cancel').textContent = cancelLabel;
    o.querySelector('.d-ok').textContent = okLabel;
    const done = v => { o.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') done(false); };
    o.querySelector('.d-cancel').onclick = () => done(false);
    o.querySelector('.d-ok').onclick = () => done(true);
    o.addEventListener('click', e => { if (e.target === o) done(false); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(o);
    o.querySelector('.d-ok').focus();
  });
}

// Inline line icons (inherit currentColor) used instead of emoji.
const ICON = {
  star: filled => `<svg class="ic${filled ? ' fill' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>`,
  x: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  check: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>`,
  calendar: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`
};
