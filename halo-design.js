/* =====================================================================
   HALO 新デザイン 1段階目（見た目の差し替え・2026-11-12）— 画面に足す仕掛け
   下書きは schedule-dev/review/halo-new.js（レビュー版の「新／今」切替・自動ログインは入れていない）。
   ・絵文字の横に線のアイコンを入れる（どちらを出すかは halo-design.css で切替。
     アイコンの字体が読み込めなかったときは絵文字のまま）
   ・見出しに英字の小さなラベルを付ける
   ・予定の種別の色を、彩度を落とした色にする（配色モード「通常」のときだけ。P型・D型／T型はそのまま）
   ・上部バーとログイン画面にロゴを入れる
   body に .hn が付いていないとき（halo_old_design=1 の端末）は何もしない。
   ===================================================================== */
(function () {
  'use strict';
  if (!document.body.classList.contains('hn')) return;

  // ---------- 絵文字 → 線のアイコン（Tabler Icons） ----------
  const ICON = {
    '🏠': 'home', '📅': 'calendar', '🗓': 'calendar-event', '👥': 'users', '📋': 'clipboard-text', '👤': 'user',
    '🏢': 'building', '📱': 'device-mobile', '🚗': 'car', '💬': 'message-circle', '✅': 'circle-check',
    '📚': 'school', '🔧': 'settings', '⚙': 'adjustments', '📢': 'speakerphone', '📌': 'pin', '🕒': 'clock',
    '⏰': 'alarm', '⏳': 'hourglass', '📊': 'chart-bar', '📈': 'trending-up', '⬇': 'download', '📍': 'map-pin',
    '🚪': 'door-exit', '☰': 'menu-2', '🔍': 'search', '🔔': 'bell', '⚠': 'alert-triangle', '📄': 'file-text',
    '📓': 'notebook', '💼': 'briefcase', '✈': 'plane', '🗑': 'trash', '✏': 'pencil', '📝': 'writing',
    '📷': 'camera', '🖼': 'photo', '📎': 'paperclip', '🔗': 'link', '📧': 'mail', '✉': 'mail', '📞': 'phone',
    '🔒': 'lock', '🔑': 'key', '🔄': 'refresh', '⭐': 'star', '🚩': 'flag', '💡': 'bulb', '🍱': 'tools-kitchen-2',
    '🎓': 'school', '💰': 'coin', '🧾': 'receipt', '📦': 'package', '🛡': 'shield', '❌': 'x', '🏡': 'home-2',
    '📂': 'folder', '📁': 'folder', '🖥': 'device-desktop', '💻': 'device-laptop', '📲': 'device-mobile-message',
    '🙋': 'hand-stop', '🆘': 'lifebuoy', '🌐': 'world', '🎨': 'palette', '🔤': 'language', '📤': 'upload',
    '📥': 'inbox', '📬': 'mailbox', '📮': 'mailbox', '🧑': 'user', '👋': 'hand-stop', '🏭': 'building-factory-2',
    '🕐': 'clock', '🏃': 'run', '🤝': 'heart-handshake', '🧑‍💼': 'user-check'
  };
  // 丸の絵文字は、状態の色の点にする
  const DOT = { '🟢': 'var(--green)', '🔴': 'var(--red)', '🟡': 'var(--orange)', '🟠': 'var(--orange)', '⚪': 'var(--text3)', '🔵': 'var(--blue)' };
  const keys = Object.keys(ICON).concat(Object.keys(DOT)).sort((a, b) => b.length - a.length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RE = new RegExp('(' + keys.map(esc).join('|') + ')\\uFE0F?', 'g');
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'SELECT', 'INPUT', 'TITLE', 'NOSCRIPT']);

  function iconFor(k) {
    if (DOT[k]) {
      const d = document.createElement('span');
      d.className = 'hn-dot';
      d.style.background = DOT[k];
      return d;
    }
    const i = document.createElement('i');
    i.className = 'ti ti-' + ICON[k] + ' hn-ic';
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function convText(tn) {
    const p = tn.parentNode;
    if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('.hn-emoji,[contenteditable="true"]'))) return;
    const s = tn.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(s)) return;
    RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = RE.exec(s))) {
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      const em = document.createElement('span');
      em.className = 'hn-emoji';
      em.textContent = m[0];
      frag.appendChild(em);
      frag.appendChild(iconFor(m[1]));
      last = m.index + m[0].length;
    }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    p.replaceChild(frag, tn);
  }

  // ---------- 見出しに英字ラベル ----------
  const EB = [
    ['今日の予定', 'Today'], ['会議室の空き', 'Rooms'], ['お知らせ', 'Notice'], ['今日の課題', 'Focus'],
    ['日報', 'Daily report'], ['安否確認', 'Safety'], ['承認待ち', 'Approvals'], ['自分の申請', 'My requests'],
    ['今週の予定', 'This week'], ['通知', 'Notifications'], ['タスク', 'Tasks'], ['貸出中', 'On loan'],
    ['社用車', 'Cars'], ['プロフィール', 'Profile'], ['言語', 'Language'], ['表示', 'Display'],
    ['色', 'Colors'], ['メンバー', 'Members'], ['在席', 'Presence'], ['申請', 'Requests'], ['承認', 'Approvals']
  ];
  const isTitleStyle = (st) => st.includes('font-weight:700') && st.includes('color:var(--text2)') && /font-size:0\.8\d?em/.test(st);

  function tagTitle(el) {
    if (el.classList.contains('hn-title')) return;
    const txt = (el.textContent || '').replace(RE, '').trim();
    if (!txt || txt.length > 30) return;
    if (el.querySelector('button,input,select,a,table,div')) return;
    el.classList.add('hn-title');
    const hit = EB.find(([ja]) => txt.startsWith(ja));
    if (hit) el.setAttribute('data-eb', hit[1]);
    // カードの一番上にある見出しは、社内ポータル型の見出し帯にする
    const card = el.closest('[style*="box-shadow:var(--shadow)"]');
    if (card && (card.getAttribute('style') || '').includes('padding:12px')) {
      const first = card.firstElementChild;
      if (first && (first === el || first.contains(el))) first.classList.add('hn-head');
    }
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { convText(root); return; }
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (w.nextNode()) texts.push(w.currentNode);
    texts.forEach(convText);
    const els = [root].concat(Array.from(root.querySelectorAll('[style*="color:var(--text2)"]')));
    els.forEach((el) => { const st = el.getAttribute && el.getAttribute('style'); if (st && isTitleStyle(st)) tagTitle(el); });
  }

  let pending = new Set(), queued = false;
  const flush = () => { queued = false; const list = Array.from(pending); pending = new Set(); list.forEach((n) => n.isConnected && scan(n)); };
  const mo = new MutationObserver((recs) => {
    recs.forEach((r) => {
      if (r.type === 'characterData') pending.add(r.target);
      r.addedNodes.forEach((n) => { if (!(n.nodeType === 1 && /(^| )hn-/.test(typeof n.className === 'string' ? n.className : ''))) pending.add(n); });
    });
    if (!queued) { queued = true; requestAnimationFrame(flush); }
  });

  // ---------- 予定の種別の色（配色モード「通常」だけ差し替える） ----------
  const HN_STATUS = {
    '会議室': '#6A8FA8', '外出': '#C08A55', '出張': '#6F9A7E', '休暇': '#BC7C90', '休み': '#C9937F', '在宅': '#5E9A9E',
    '打ち合わせ': '#8C80B0', '来社': '#C27F6A', 'その他': '#9A9F98', '作業': '#A8956A', '在席': '#5E9C76', '会議中': '#6A8FA8'
  };
  function applyStatusColors() {
    if (typeof COLOR_PALETTES === 'undefined' || typeof STATUS_COLOR === 'undefined') return;
    Object.assign(COLOR_PALETTES.normal, HN_STATUS); // 設定で「通常」に戻したときも新しい色になる
    if (typeof colorMode !== 'undefined' && colorMode !== 'normal') return;
    Object.assign(STATUS_COLOR, HN_STATUS);
    if (typeof currentUser !== 'undefined' && currentUser && typeof renderAll === 'function') {
      try { renderAll(); } catch (e) { console.warn('[HALO design] 再描画できませんでした', e); }
    }
  }

  // ---------- ロゴ ----------
  function addLogos() {
    const title = document.querySelector('.topbar .topbar-title');
    if (title && !document.querySelector('.topbar .hn-logo')) {
      title.insertAdjacentHTML('afterend', '<span class="hn-logo"><img src="brand/halo-logo-white.svg" alt="HALO"></span>');
    }
    const login = document.querySelector('.login-logo');
    if (login && !login.querySelector('.hn-logo')) login.insertAdjacentHTML('afterbegin', '<div class="hn-logo"><img src="brand/halo-logo.svg" alt="HALO"></div>');
  }

  // ---------- 上部バーの右側（タブレット・PC）：お知らせのベル＋自分の丸アイコン ----------
  // 採用案と同じく、名前とログアウトは上部バー・左メニューから外し、丸アイコンを押すと出るメニューに入れる。
  // スマホ（599px 以下）は今までどおり「名前＋ログアウト」（CSS で出し分け）。
  function addTopbarRight() {
    const bar = document.querySelector('.topbar');
    if (!bar || bar.querySelector('.hn-actions')) return;
    bar.insertAdjacentHTML('beforeend',
      '<span class="hn-actions">' +
        '<button type="button" class="hn-bell" aria-label="お知らせ"><i class="ti ti-bell" aria-hidden="true"></i><span class="hn-bell-badge"></span></button>' +
        '<button type="button" class="hn-avatar" aria-label="自分のメニュー" aria-haspopup="true" aria-expanded="false"></button>' +
        '<span class="hn-menu" role="menu">' +
          '<span class="hn-menu-who"></span>' +
          '<button type="button" role="menuitem" data-go="mypage"><i class="ti ti-user" aria-hidden="true"></i>マイページ</button>' +
          '<button type="button" role="menuitem" data-go="settings"><i class="ti ti-settings" aria-hidden="true"></i>設定</button>' +
          '<button type="button" role="menuitem" data-go="logout" class="hn-menu-out"><i class="ti ti-logout" aria-hidden="true"></i>ログアウト</button>' +
        '</span>' +
      '</span>');
    const wrap = bar.querySelector('.hn-actions');
    const av = wrap.querySelector('.hn-avatar');
    const menu = wrap.querySelector('.hn-menu');
    const close = () => { wrap.classList.remove('open'); av.setAttribute('aria-expanded', 'false'); };
    av.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = wrap.classList.toggle('open');
      av.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-go]');
      if (!b) return;
      close();
      if (b.dataset.go === 'logout') { if (typeof doLogout === 'function') doLogout(); return; }
      if (typeof switchTab === 'function') switchTab(b.dataset.go);
    });
    wrap.querySelector('.hn-bell').addEventListener('click', () => {
      if (typeof switchTab === 'function') switchTab('home');
      const n = document.getElementById('notice-home-wrap');
      if (n) setTimeout(() => n.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    });
    // 名前（元の #topbar-user）と、お知らせの未読数（元の #notice-badge-side）を写す
    const who = wrap.querySelector('.hn-menu-who');
    const user = document.getElementById('topbar-user');
    const syncUser = () => {
      const name = (user && user.textContent || '').trim();
      av.textContent = name ? name.replace(/\s/g, '').charAt(0) : '';
      who.textContent = name;
    };
    const badge = wrap.querySelector('.hn-bell-badge');
    const src = document.getElementById('notice-badge-side');
    const syncBadge = () => {
      const on = src && src.style.display !== 'none' && src.textContent.trim();
      badge.textContent = on ? src.textContent.trim() : '';
      badge.style.display = on ? '' : 'none';
    };
    syncUser(); syncBadge();
    if (user) new MutationObserver(syncUser).observe(user, { childList: true, characterData: true, subtree: true });
    if (src) new MutationObserver(syncBadge).observe(src, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }

  // 採用案の左メニューには「たたむ」ボタンが無いので、PC でたたんだままの人は開いた状態に戻す
  function expandSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('collapsed') && typeof toggleSidebarCollapse === 'function') {
      try { toggleSidebarCollapse(); } catch (e) { /* 戻せなくても表示は崩れない */ }
    }
  }

  // ---------- 線のアイコンの字体が読み込めたら、絵文字を隠す ----------
  function watchIconFont() {
    const ok = () => document.body.classList.add('hn-ic-ok');
    const link = document.getElementById('hn-tabler');
    if (!link) return;
    if (link.sheet) ok(); else link.addEventListener('load', ok);
  }

  function start() {
    watchIconFont();
    addLogos();
    addTopbarRight();
    expandSidebar();
    // ログインのたびに元の処理（restoreSidebarState）がたたんだ状態を戻すので、それも「開く」に置き換える
    if (typeof restoreSidebarState === 'function') window.restoreSidebarState = expandSidebar;
    hideInquiry();
    addHomeHead();
    applyStatusColors();
    scan(document.body);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // ---------- 2段階目（11/12）：問い合わせを隠す ----------
  // 左メニュー・上のタブは CSS で隠す。スマホの「その他」シートは MORE_TABS から外す（準備中で押せない項目）
  function hideInquiry() {
    try {
      if (typeof MORE_TABS !== 'undefined' && Array.isArray(MORE_TABS)) {
        const i = MORE_TABS.indexOf('inquiry');
        if (i >= 0) MORE_TABS.splice(i, 1);
      }
    } catch (e) { /* 隠せなくても動く */ }
  }

  // ---------- 2段階目：ホームの見出しと挨拶（タブレット・PC。採用案の「ホーム／こんにちは、○○さん・日付」） ----------
  const HELLO = { ja: 'こんにちは、{n}さん', vi: 'Xin chào, {n}', ne: 'नमस्ते, {n}' };
  const LOCALE = { ja: 'ja-JP', vi: 'vi-VN', ne: 'ne-NP' };
  function addHomeHead() {
    const home = document.getElementById('tab-home');
    if (!home || home.querySelector('.hn-page-head')) return;
    home.insertAdjacentHTML('afterbegin', '<div class="hn-page-head"><h1 class="hn-page-title"></h1><p class="hn-page-hello"></p></div>');
    updateHomeHead();
    const user = document.getElementById('topbar-user');
    if (user) new MutationObserver(updateHomeHead).observe(user, { childList: true, characterData: true, subtree: true });
    setInterval(updateHomeHead, 60 * 1000); // 日付が変わったとき用
  }
  function updateHomeHead() {
    const head = document.querySelector('#tab-home .hn-page-head');
    if (!head) return;
    const lang = (typeof currentLang !== 'undefined' && HELLO[currentLang]) ? currentLang : 'ja';
    const label = document.querySelector('.sidebar-btn[data-tab="home"] .sidebar-label');
    head.querySelector('.hn-page-title').textContent = (label && label.textContent.trim()) || 'ホーム';
    const full = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || (document.getElementById('topbar-user') || {}).textContent || '';
    const name = String(full).trim().split(/[\s　]+/)[0];
    let date = '';
    try {
      date = new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
      if (lang === 'ja') date = date.replace(/\((.)\)/, '（$1）').replace(/^(.*日)(.)$/, '$1（$2）');
    } catch (e) { date = ''; }
    head.querySelector('.hn-page-hello').textContent = (name ? HELLO[lang].replace('{n}', name) : '') + (name && date ? '・' : '') + date;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
