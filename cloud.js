// Firebase sync: Google sign-in + Firestore. localStorage stays as the fast local cache,
// Firestore holds the source of truth per user (users/{uid}/...). Inactive until firebase-config.js is filled in.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const cfg = window.FIREBASE_CONFIG;
if (cfg && cfg.apiKey) start(cfg);

function start(cfg) {
  const root = document.documentElement;
  root.classList.add('auth-pending');
  const unlock = setTimeout(() => root.classList.remove('auth-pending'), 4000); // never leave the page blank (e.g. offline)

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: persistentLocalCache() }); // offline-first
  let uid = null;

  const LOCAL_KEYS = [KEY_ACTIVE, KEY_HISTORY, KEY_FAV, 'gym.uid'];
  const clearLocal = () => LOCAL_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} });
  const setLocal = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const dataDoc = name => doc(db, 'users', uid, 'data', name);

  cloud.onSave = (key, val) => {
    if (!uid) return;
    setDoc(dataDoc(key === KEY_ACTIVE ? 'active' : 'favorites'), { value: val ?? null, updatedAt: Date.now() })
      .catch(e => console.warn('cloud save failed', e));
  };
  cloud.onAdd = entry => {
    if (!uid) return;
    setDoc(doc(db, 'users', uid, 'workouts', entry.id), entry).catch(e => console.warn('cloud save failed', e));
  };

  async function sync() {
    if (!uid) return;
    try {
      const [a, f, w] = await Promise.all([
        getDoc(dataDoc('active')), getDoc(dataDoc('favorites')), getDocs(collection(db, 'users', uid, 'workouts'))
      ]);
      // active workout + favorites: the cloud copy wins; if the cloud has none yet, upload the local one
      if (a.exists()) setLocal(KEY_ACTIVE, a.data().value);
      else if (load(KEY_ACTIVE, null)) cloud.onSave(KEY_ACTIVE, load(KEY_ACTIVE, null));
      if (f.exists()) setLocal(KEY_FAV, f.data().value || []);
      else if (load(KEY_FAV, []).length) cloud.onSave(KEY_FAV, load(KEY_FAV, []));
      // history: union by id (local-only entries, e.g. from before sign-in, are uploaded)
      const byId = new Map();
      w.forEach(d => byId.set(d.id, d.data()));
      load(KEY_HISTORY, []).forEach((e, i) => {
        e.id = e.id || `L${e.date}-${i}`;
        if (!byId.has(e.id)) { byId.set(e.id, e); cloud.onAdd(e); }
      });
      setLocal(KEY_HISTORY, [...byId.values()].sort((x, y) => x.date.localeCompare(y.date)));
      window.dispatchEvent(new Event('gym:synced'));
    } catch (e) {
      if (e.code === 'permission-denied') showDenied(); // signed in, but not on the invite list
      else console.warn('cloud sync failed', e);
    }
  }

  // --- sign-in screen ---
  let gate = null;
  function showGate() {
    if (gate) return;
    gate = document.createElement('div');
    gate.className = 'gate';
    gate.innerHTML = `<h1>健身紀錄</h1><p>登入後，訓練紀錄會同步到雲端，<br>換手機或電腦也看得到。</p>
      <button class="cta" type="button">使用 Google 登入</button><p class="err" role="alert"></p>`;
    gate.querySelector('.cta').onclick = async () => {
      const err = gate.querySelector('.err'); err.textContent = '';
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try { await signInWithPopup(auth, provider); }
      catch (e) {
        // Redirect sign-in only works when the site is served from the auth domain itself
        // (cross-site storage is partitioned elsewhere, e.g. on github.io), so use it only there.
        const sameSite = location.hostname === cfg.authDomain || location.hostname.endsWith('.web.app');
        if (sameSite && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment'))
          return signInWithRedirect(auth, provider);
        if (e.code === 'auth/popup-blocked')
          err.textContent = '登入視窗被瀏覽器擋住了，請允許這個網站的彈出視窗後再按一次；如果是在 LINE、Instagram 等 App 內開啟，請改用 Safari 或 Chrome 開啟。';
        else if (e.code === 'auth/unauthorized-domain')
          err.textContent = '這個網址還沒有被授權登入，請聯絡管理者。';
        else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request')
          err.textContent = '登入失敗，請再試一次（' + (e.code || e.message) + '）';
      }
    };
    document.body.appendChild(gate);
  }
  const hideGate = () => { gate?.remove(); gate = null; };
  function showDenied() {
    if (gate) return;
    gate = document.createElement('div');
    gate.className = 'gate';
    gate.innerHTML = `<h1>尚未受邀</h1><p>這個帳號還不在使用名單上，<br>請聯絡管理者把你的 Google 帳號加入。</p>
      <button class="cta" type="button">登出</button>`;
    gate.querySelector('.cta').onclick = async () => { await signOut(auth); clearLocal(); location.reload(); };
    document.body.appendChild(gate);
  }

  onAuthStateChanged(auth, user => {
    clearTimeout(unlock);
    root.classList.remove('auth-pending');
    if (!user) { uid = null; showGate(); return; }
    hideGate();
    uid = user.uid;
    const prev = localStorage.getItem('gym.uid');
    if (prev && prev !== uid) clearLocal(); // another account used this browser before
    localStorage.setItem('gym.uid', uid);
    const acct = document.getElementById('acct');
    if (acct) {
      acct.hidden = false;
      acct.onclick = async () => {
        if (await confirmDialog(`已登入：${user.email}`, '登出', '關閉')) { await signOut(auth); clearLocal(); location.reload(); }
      };
    }
    sync();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
}
