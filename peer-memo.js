/*
 * 他者評価メモ（HALO）  ※主任以上のみ
 *
 * 【このファイルは暗号化の専用ファイルです。通常の改修で触らないでください】
 *   - 評価内容は、このブラウザの中で暗号化してからGASへ送る。GAS・kintoneには平文を渡さない。
 *   - 暗号化: 副社長のRSA公開鍵（955/1117と同じ鍵）＋ 入力者本人のブラウザ固有鍵（AES-GCM, 取り出し不可）の二重。
 *   - 入力者本人の鍵は IndexedDB（社員番号ごと）。端末・ブラウザを変えると過去分は復号できない（許容済みの仕様）。
 *   - 副社長の復号は秘密鍵JWKの貼り付け方式（kintone版と同じ）。第2段階で実装する。
 *   - このファイル・副社長公開鍵・鍵登録簿(1119)の改変は、AI利用規定で禁止事項として扱う。
 *   - 設計: ドキュメント\Claude\他者評価メモ_HALO移行設計案.md
 */
(function () {
  'use strict';

  // 副社長の公開鍵（kintone版 peer_evaluation_memo.js と同一）
  const VP_PUBLIC_KEY_JWK = {
    alg: 'RSA-OAEP-256', e: 'AQAB', ext: true, key_ops: ['encrypt'], kty: 'RSA',
    n: '6DsGkafFsyo1M7rRbXQQzFq8I79OMC84-6Z1FhzVSlvC9JaJUZT-kq_ZLLKjJuGuPyD1Hhr5fbhyZKDe9_rzCu2c0HZq2GMkPz1oB5Qfh4lWM403C89vC-AZMpjaQjMjwOLKieL4nwfibiLYrkC0sMeDaiXNjjXdVXVrqDcA73HXYxMoZhl4Nd24bGO2Om4KsexPbt0cibHPtgxIWKzpKDB7baVcnhQZAZQkpXiA4E3w-l0wfEnxUENBctr94vtMAOZmvtVCbIGNG-bdPLchmUGJTtS2hIxWj4A1qMiu_whclMJci4TNwheS92-fZDY3IA-Xi_yv2644iJHwkvzB5ALTzLKdNEP4gs1Tr4XDWc1mI9HwlJ1Sy8FU_Z2monSrEvoWSS8Hu4tjZzACrklQDLAM45kwehL958YhomHEf91Xrx78QThA931_iCKUNB6wGTBQtUL4d2AkmLYqGofLBIR7dh1mIjfoq1SbKev9MxDJ_WqpSifrA1aqczMMB2dLG0Anm3TNr6JqDLugRp8aRnii9VnOgp3IYuW1J4LKXybwfgRzVLZuqopWgHrvGee11gz-pN_LLgUJgfNPSDnJR3wNgvkeMSGPG0bISAS3EDt1Bk6fTNSfjyefuS1iXALIV0FEDr_d20dNzNJhPcTWAg94WG2hr1pZTI9wXdQobb0'
  };

  const DB_NAME = 'halo_peer_memo_keystore';
  const STORE = 'keys';

  // ---------- 暗号 ----------
  function b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s);
  }
  function unb64(str) {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function idbGet(db, key) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  function idbPut(db, key, value) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // 入力者本人の鍵。社員番号ごと（共用端末で別の人が入力しても鍵が混ざらない）。取り出し不可で保存する
  async function getOrCreateOwnerKey(create) {
    const uid = (typeof currentUser !== 'undefined' && currentUser && currentUser.id) || '';
    if (!uid) throw new Error('ログイン情報を取得できません');
    const db = await openDb();
    const id = 'owner-aes-key:' + uid;
    const existing = await idbGet(db, id);
    if (existing) return existing;
    if (!create) return null;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await idbPut(db, id, key);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* 失敗しても動作に影響なし */ }
    return key;
  }

  async function encryptForOwner(key, text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    return { type: 'AES-GCM-BrowserKey', iv: b64(iv), cipherText: b64(ct) };
  }
  async function decryptForOwner(key, pkg) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(pkg.iv) }, key, unb64(pkg.cipherText));
    return new TextDecoder().decode(plain);
  }
  async function encryptForVp(text) {
    const pub = await crypto.subtle.importKey('jwk', VP_PUBLIC_KEY_JWK, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(text));
    const encKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, await crypto.subtle.exportKey('raw', aes));
    return { alg: 'RSA-OAEP-256+A256GCM', encryptedKey: b64(encKey), iv: b64(iv), cipherText: b64(ct) };
  }

  // 副社長の秘密鍵はここ（復号の瞬間）でだけ使い、保存しない
  async function decryptForVp(privateKeyJwk, pkg) {
    const priv = await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
    const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, unb64(pkg.encryptedKey));
    const aes = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(pkg.iv) }, aes, unb64(pkg.cipherText));
    return new TextDecoder().decode(plain);
  }

  // 副社長公開鍵の指紋（SHA-256の先頭8バイト）。副社長が手元の鍵と照合できるように入力画面へ表示する
  async function vpFingerprint() {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(VP_PUBLIC_KEY_JWK.n));
    return Array.from(new Uint8Array(digest).slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join(':');
  }

  // ---------- API（GAS_URL未設定のデモモードは端末内の模擬データ） ----------
  const DEMO_KEY = 'pm_demo_memos';
  function demoLoad() { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || []; } catch (e) { return []; } }
  const demoWait = (v) => new Promise((r) => setTimeout(() => r(v), 150));

  function pmApi(action, data, msg) {
    if (typeof GAS_URL !== 'undefined' && GAS_URL) return api(action, data, msg);
    if (action === 'getPeerMemoInit') {
      return demoWait({
        today: new Date().toISOString().slice(0, 10),
        targets: [{ name: 'テスト 一郎', org: '製造' }, { name: 'テスト 二郎', org: '製造' }, { name: 'テスト 花子', org: '設計' }]
      });
    }
    if (action === 'savePeerMemo') {
      const list = demoLoad();
      const m = data.memo;
      const c = JSON.parse(m.cipher);
      list.push({ id: String(Date.now()), target: m.target, org: '', date: m.date, item: m.item || '', owner: c.ownerEncrypted });
      localStorage.setItem(DEMO_KEY, JSON.stringify(list));
      return demoWait({ id: list.length });
    }
    if (action === 'getMyPeerMemos') {
      return demoWait({ records: demoLoad().filter((r) => r.date >= data.from && r.date < data.to) });
    }
    return Promise.reject(new Error('デモモード未対応: ' + action));
  }

  // ---------- 画面 ----------
  const E = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const BTN = 'padding:10px;border-radius:10px;border:none;background:var(--primary);color:white;font-weight:700;font-size:0.95em;cursor:pointer';
  const INP = 'width:100%;box-sizing:border-box;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:0.9em;font-family:inherit';

  let state = { init: null, tab: 'input', month: '', records: null, pKind: 'month', pFy: 0, pQ: 1, vp: null, vpLabel: '' };

  function monthRange(ym) {
    const [y, m] = ym.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    return { from: `${ym}-01`, to: `${next}-01` };
  }

  async function openPeerMemo() {
    try {
      state.init = await pmApi('getPeerMemoInit', {}, '読み込み中…');
    } catch (e) { showToast(e.message); return; }
    state.tab = 'input';
    state.month = state.init.today.slice(0, 7);
    state.records = null;
    await render();
  }

  function tabBtn(id, label) {
    const on = state.tab === id;
    return `<button onclick="pmTab('${id}')" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid var(--primary);background:${on ? 'var(--primary)' : 'white'};color:${on ? 'white' : 'var(--primary)'};font-weight:700;font-size:0.85em;cursor:pointer">${label}</button>`;
  }

  async function render() {
    const head = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <h3 style="margin:0;font-size:1em;font-weight:700">🗒 他者評価メモ</h3>
        <button onclick="closeDrModal()" style="border:none;background:none;font-size:1.2em;cursor:pointer;color:var(--text2)">✕</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">${tabBtn('input', '入力')}${tabBtn('status', '自分の入力状況')}${tabBtn('cov', '月次記入状況')}${isAdminUser() ? tabBtn('vp', '副社長用') : ''}</div>`;
    let inner;
    if (state.tab === 'input') inner = await inputHtml();
    else if (state.tab === 'status') inner = statusHtml();
    else if (state.tab === 'cov') inner = covHtml();
    else inner = vpHtml();
    openDrModal(head + inner);
    document.getElementById('dr-modal-body').style.maxWidth = (state.tab === 'cov' || state.tab === 'vp') ? 'min(1000px, 96vw)' : '560px';
    if (state.tab === 'status' && state.records === null) loadStatus();
  }

  async function inputHtml() {
    const { targets, today } = state.init;
    const byOrg = {};
    targets.forEach((t) => { (byOrg[t.org || '（組織なし）'] = byOrg[t.org || '（組織なし）'] || []).push(t); });
    const opts = Object.keys(byOrg).map((org) =>
      `<optgroup label="${E(org)}">${byOrg[org].map((t) => `<option value="${E(t.name)}">${E(t.name)}</option>`).join('')}</optgroup>`).join('');
    const fp = await vpFingerprint();
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="font-size:0.8em;font-weight:700">対象者
          <select id="pm-target" style="${INP};margin-top:4px"><option value="">選択してください</option>${opts}</select></label>
        <label style="font-size:0.8em;font-weight:700">記入日
          <input id="pm-date" type="date" value="${E(today)}" max="${E(today)}" style="${INP};margin-top:4px"></label>
        <label style="font-size:0.8em;font-weight:700">評価項目（任意）
          <input id="pm-item" type="text" maxlength="200" placeholder="例: 報告、連絡（わからなければ空欄でOK）" style="${INP};margin-top:4px"></label>
        <label style="font-size:0.8em;font-weight:700">評価内容（メモ）
          <textarea id="pm-body" rows="6" placeholder="感じたこと・見たことをそのまま書いてください" style="${INP};margin-top:4px;min-height:120px"></textarea></label>
        <div style="font-size:0.74em;color:var(--text2);padding:6px 8px;background:var(--bg);border-radius:8px;line-height:1.6">
          この内容はこの端末で暗号化してから保存されます。読めるのは<b>入力者本人と副社長だけ</b>です（システム管理者・対象者には見えません）。<br>
          本人が後から読めるのは、<b>入力したこの端末・ブラウザ</b>だけです。<br>
          暗号化に使う副社長の公開鍵の指紋: <span style="font-family:monospace">${E(fp)}</span>
        </div>
        <button id="pm-save" onclick="pmSave()" style="${BTN}">暗号化して保存</button>
      </div>`;
  }

  async function save() {
    const target = document.getElementById('pm-target').value;
    const date = document.getElementById('pm-date').value;
    const item = document.getElementById('pm-item').value.trim();
    const body = document.getElementById('pm-body').value.trim();
    if (!target) { showToast('対象者を選択してください'); return; }
    if (!date) { showToast('記入日を入力してください'); return; }
    if (!body) { showToast('評価内容（メモ）を入力してください'); return; }
    const btn = document.getElementById('pm-save');
    btn.disabled = true;
    try {
      const ownerKey = await getOrCreateOwnerKey(true);
      const vpEncrypted = await encryptForVp(body);
      const ownerEncrypted = await encryptForOwner(ownerKey, body);
      const cipher = JSON.stringify({ vpEncrypted, ownerEncrypted });
      await pmApi('savePeerMemo', { memo: { target, date, item, cipher } }, '暗号化して保存中…');
      state.records = null;
      showToast('保存しました');
      document.getElementById('pm-body').value = '';
      document.getElementById('pm-item').value = '';
    } catch (e) {
      showToast(e.message || '保存に失敗しました');
    } finally {
      btn.disabled = false;
    }
  }

  function statusHtml() {
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <input id="pm-month" type="month" value="${E(state.month)}" onchange="pmMonth(this.value)" style="${INP};width:auto">
        <span style="font-size:0.75em;color:var(--text2)">自分が入力した分だけ表示されます</span>
      </div>
      <div id="pm-status-body" style="font-size:0.85em;color:var(--text2)">読み込み中…</div>`;
  }

  async function loadStatus() {
    const box = () => document.getElementById('pm-status-body');
    try {
      const { from, to } = monthRange(state.month);
      const res = await pmApi('getMyPeerMemos', { from, to }, '読み込み中…');
      state.records = res.records || [];
    } catch (e) { if (box()) box().textContent = e.message || '読み込みに失敗しました'; return; }
    if (!box()) return;
    const recs = state.records;
    if (!recs.length) { box().textContent = 'この月の入力はありません。'; return; }
    const by = {};
    recs.forEach((r) => { (by[r.target] = by[r.target] || []).push(r); });
    box().innerHTML = `<div style="margin-bottom:6px;color:var(--text)">合計 <b>${recs.length}</b> 件 / ${Object.keys(by).length} 名</div>` +
      Object.keys(by).map((name) => `
        <div style="border:1.5px solid var(--border);border-radius:10px;padding:8px;margin-bottom:6px;background:white">
          <div style="font-weight:700;color:var(--text)">${E(name)} <span style="font-weight:600;color:var(--text2);font-size:0.85em">${by[name].length}件</span></div>
          ${by[name].map((r) => `
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
              <div style="font-size:0.8em;color:var(--text2)">${E(r.date)}${r.item ? ' ／ ' + E(r.item) : ''}
                <button onclick="pmDecrypt('${E(r.id)}')" style="margin-left:6px;padding:2px 8px;border-radius:6px;border:1.5px solid var(--primary);background:white;color:var(--primary);font-weight:700;font-size:0.9em;cursor:pointer">復号して表示</button></div>
              <div id="pm-dec-${E(r.id)}" style="white-space:pre-wrap;word-break:break-word;color:var(--text);margin-top:4px"></div>
            </div>`).join('')}
        </div>`).join('');
  }

  async function decrypt(id) {
    const out = document.getElementById('pm-dec-' + id);
    const rec = (state.records || []).find((r) => r.id === id);
    if (!out || !rec) return;
    try {
      const key = await getOrCreateOwnerKey(false);
      if (!key || !rec.owner) throw new Error('この端末にはこのメモを読む鍵がありません（別の端末・ブラウザで入力したメモは、そちらでのみ読めます）');
      out.textContent = await decryptForOwner(key, rec.owner);
    } catch (e) {
      out.textContent = e.name === 'OperationError'
        ? '復号できませんでした（別の端末・ブラウザで入力したメモは、そちらでのみ読めます）'
        : (e.message || '復号に失敗しました');
    }
  }

  function isAdminUser() { return typeof currentUser !== 'undefined' && !!(currentUser && currentUser.isAdmin); }

  // ---------- 期間（月 or 会計年度の四半期。会計年度は7月開始: Q1=7〜9月 Q2=10〜12月 Q3=1〜3月 Q4=4〜6月） ----------
  function fiscalRange(fy, q) {
    const p = (n) => String(n).padStart(2, '0');
    const startM = 7 + (q - 1) * 3;                  // 7, 10, 13, 16（13以降は翌年）
    const endM = startM + 3;
    const ym = (n) => ({ y: fy + Math.floor((n - 1) / 12), m: ((n - 1) % 12) + 1 });
    const s = ym(startM), e = ym(endM), last = ym(endM - 1);
    return { from: `${s.y}-${p(s.m)}-01`, to: `${e.y}-${p(e.m)}-01`, label: `${fy}年度Q${q}（${s.m}〜${last.m}月）` };
  }
  function currentPeriod() {
    if (state.pKind === 'quarter') return fiscalRange(Number(state.pFy), Number(state.pQ));
    const r = monthRange(state.month);
    const [y, m] = state.month.split('-');
    return { from: r.from, to: r.to, label: `${y}年${Number(m)}月` };
  }
  function initFiscal() {
    if (state.pFy) return;
    const [y, m] = state.init.today.split('-').map(Number);
    state.pFy = m >= 7 ? y : y - 1;
    state.pQ = m >= 7 && m <= 9 ? 1 : m >= 10 ? 2 : m <= 3 ? 3 : 4;
  }
  function periodHtml() {
    const fy0 = Number(state.pFy);
    const years = [fy0 - 1, fy0, fy0 + 1].map((y) => `<option value="${y}"${y === fy0 ? ' selected' : ''}>${y}年度</option>`).join('');
    const qs = [1, 2, 3, 4].map((q) => `<option value="${q}"${q === Number(state.pQ) ? ' selected' : ''}>Q${q}</option>`).join('');
    return `
      <select onchange="pmKind(this.value)" style="${INP};width:auto">
        <option value="month"${state.pKind === 'month' ? ' selected' : ''}>月</option>
        <option value="quarter"${state.pKind === 'quarter' ? ' selected' : ''}>四半期</option></select>
      ${state.pKind === 'month'
        ? `<input type="month" value="${E(state.month)}" onchange="pmPeriod('month',this.value)" style="${INP};width:auto">`
        : `<select onchange="pmPeriod('fy',this.value)" style="${INP};width:auto">${years}</select>
           <select onchange="pmPeriod('q',this.value)" style="${INP};width:auto">${qs}</select>`}`;
  }

  // ---------- 月次記入状況（主任以上。暗号文は触らない） ----------
  function covHtml() {
    initFiscal();
    return `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${periodHtml()}
        <button onclick="pmCovRun()" style="padding:8px 14px;border-radius:8px;border:none;background:var(--primary);color:white;font-weight:700;font-size:0.85em;cursor:pointer">表示</button>
      </div>
      <div id="pm-cov-body" style="font-size:0.85em;color:var(--text2)">期間を選んで「表示」を押してください。</div>`;
  }
  async function covRun() {
    const box = document.getElementById('pm-cov-body');
    box.textContent = '集計中…';
    try {
      const per = currentPeriod();
      const r = await pmApi('getPeerMemoCoverage', { from: per.from, to: per.to }, '集計中…');
      const byOrg = {};
      r.uncovered.forEach((x) => { const k = x.org || '（組織未設定）'; (byOrg[k] = byOrg[k] || []).push(x.name); });
      box.innerHTML = `
        <div style="padding:6px 10px;background:var(--primary-light);border-radius:8px;color:var(--primary-dark);font-weight:700;margin-bottom:8px">
          ${E(per.label)} ／ 対象者 ${r.eligibleCount}名 ／ 記入あり ${r.coveredCount}名 ／ 記入件数 ${r.entryCount}件</div>
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">まだ記入されていない対象者（${r.uncovered.length}名）</div>
        ${r.uncovered.length ? Object.keys(byOrg).map((org) => `
          <div style="margin-bottom:6px"><span style="font-size:0.8em;color:var(--text2)">${E(org)}</span>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">${byOrg[org].map((n) => `<span style="padding:3px 8px;border-radius:12px;background:#fff8e1;color:#e65100;font-size:0.85em">${E(n)}</span>`).join('')}</div></div>`).join('')
          : '<div>全員分の記入があります。</div>'}`;
    } catch (e) { box.textContent = e.message || '集計に失敗しました'; }
  }

  // ---------- 副社長用: 復号してCSV出力（管理者のみ。秘密鍵は貼り付け→この画面内だけで使い、保存しない） ----------
  function vpHtml() {
    initFiscal();
    const opts = ((state.vp && state.vp.creators) || []).map((c) => `<option value="${E(c.key)}">${E(c.name)}</option>`).join('');
    return `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${periodHtml()}
        <button onclick="pmVpLoad()" style="padding:8px 14px;border-radius:8px;border:1.5px solid var(--primary);background:white;color:var(--primary);font-weight:700;font-size:0.85em;cursor:pointer">入力者候補を更新</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <label style="font-size:0.8em;font-weight:700">入力者で絞り込み</label>
        <select id="pm-vp-creator" style="${INP};width:auto"><option value="">全員分</option>${opts}</select>
      </div>
      <textarea id="pm-vp-key" rows="3" placeholder="副社長の秘密鍵JWKを貼り付け（この端末・サーバーには保存されません）" style="${INP};margin-bottom:8px"></textarea>
      <button onclick="pmVpRun()" style="${BTN};width:100%">この期間を復号して表示</button>
      <div id="pm-vp-body" style="margin-top:10px;font-size:0.85em"></div>`;
  }
  async function vpLoadCreators() {
    try {
      const per = currentPeriod();
      const r = await pmApi('getPeerMemoCoverage', { from: per.from, to: per.to }, '読み込み中…');
      state.vp = { creators: r.creators || [] };
      const sel = document.getElementById('pm-vp-creator');
      if (sel) sel.innerHTML = '<option value="">全員分</option>' + state.vp.creators.map((c) => `<option value="${E(c.key)}">${E(c.name)}</option>`).join('');
    } catch (e) { showToast(e.message); }
  }
  function csvEsc(v) { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function downloadCsv(filename, rows) {
    const lines = [['対象者', '記入日', '入力者', '評価項目', '内容'].join(',')]
      .concat(rows.map((r) => [r.target, r.date, r.creatorName, r.item, r.content].map(csvEsc).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });   // ExcelでUTF-8として開けるようBOM付き
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function vpRun() {
    const box = document.getElementById('pm-vp-body');
    const keyText = document.getElementById('pm-vp-key').value.trim();
    const sel = document.getElementById('pm-vp-creator');
    const creatorKey = sel.value;
    const creatorLabel = creatorKey ? sel.options[sel.selectedIndex].textContent : '全員分';
    if (!keyText) { showToast('秘密鍵を貼り付けてください'); return; }
    let jwk;
    try { jwk = JSON.parse(keyText); } catch (e) { box.textContent = '秘密鍵の形式が正しくありません（JWKのJSONを貼り付けてください）'; return; }
    box.textContent = '復号中…';
    try {
      const per = currentPeriod();
      const res = await pmApi('getPeerMemosForVp', { from: per.from, to: per.to, creatorKey }, '取得中…');
      const rows = [];
      for (const r of res.records || []) {
        let content;
        try { content = await decryptForVp(jwk, r.vp); }
        catch (e) { content = '[復号失敗: ' + (e.message || e.name || '不明なエラー') + ']'; }
        rows.push({ target: r.target, date: r.date, creatorName: r.creatorName, item: r.item, content });
      }
      // 全員分のときだけ、記入のなかった対象者も行にしておく（AIで全員分を漏れなく採点するため）
      (res.noEntry || []).forEach((n) => rows.push({ target: n, date: '', creatorName: '', item: '', content: '(この期間の記入なし)' }));
      rows.sort((a, b) => a.target.localeCompare(b.target, 'ja'));
      window._pmVpRows = rows;   // 画面を閉じるまでのメモリ上だけ。保存しない
      state.vpLabel = `${per.label}_${creatorLabel}`;
      const th = ['対象者', '記入日', '入力者', '評価項目', '内容'].map((h) => `<th style="position:sticky;top:0;background:var(--primary-light);padding:5px 6px;text-align:left;white-space:nowrap">${h}</th>`).join('');
      const td = 'padding:4px 6px;border-top:1px solid var(--border);';
      box.innerHTML = `
        <div style="padding:6px 10px;background:var(--primary-light);border-radius:8px;color:var(--primary-dark);font-weight:700;margin-bottom:8px">${E(per.label)} ／ ${E(creatorLabel)}: ${rows.length}件を復号しました</div>
        <button onclick="pmVpCsv()" style="padding:8px 14px;border-radius:8px;border:1.5px solid var(--primary);background:white;color:var(--primary);font-weight:700;font-size:0.85em;cursor:pointer;margin-bottom:8px">CSV出力</button>
        <div style="overflow:auto;max-height:50vh;border:1px solid var(--border);border-radius:8px"><table style="border-collapse:collapse;width:100%;font-size:0.8em">
          <thead><tr>${th}</tr></thead>
          <tbody>${rows.map((r) => `<tr><td style="${td}white-space:nowrap">${E(r.target)}</td><td style="${td}white-space:nowrap;color:var(--text2)">${E(r.date)}</td><td style="${td}white-space:nowrap">${E(r.creatorName)}</td><td style="${td}">${E(r.item)}</td><td style="${td}white-space:pre-wrap;word-break:break-word">${E(r.content)}</td></tr>`).join('')}</tbody></table></div>`;
    } catch (e) { box.textContent = '復号に失敗しました: ' + (e.message || e.name || '不明なエラー'); }
  }

  window.pmKind = (v) => { state.pKind = v; render(); };
  window.pmPeriod = (which, v) => {
    if (which === 'month') { if (/^\d{4}-\d{2}$/.test(v)) state.month = v; }
    else if (which === 'fy') state.pFy = Number(v);
    else if (which === 'q') state.pQ = Number(v);
  };
  window.pmCovRun = covRun;
  window.pmVpLoad = vpLoadCreators;
  window.pmVpRun = vpRun;
  window.pmVpCsv = () => downloadCsv(`他者評価メモ_${(state.vpLabel || '').replace(/[\\/:*?"<>|]/g, '_')}.csv`, window._pmVpRows || []);

  window.openPeerMemo = openPeerMemo;
  window.pmTab = (id) => { state.tab = id; render(); };
  window.pmMonth = (v) => { if (!/^\d{4}-\d{2}$/.test(v)) return; state.month = v; state.records = null; const b = document.getElementById('pm-status-body'); if (b) b.textContent = '読み込み中…'; loadStatus(); };
  window.pmSave = save;
  window.pmDecrypt = decrypt;
})();
