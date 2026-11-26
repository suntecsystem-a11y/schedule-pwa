/* HALO「開発管理」タブの画面（2026-11-26）
 * 開発の状況（かんばん）・設計書・設計図のビフォー／アフター比較を、開発に関わる人だけが見る。
 * このファイルは公開リポジトリに置くので、中身（一覧・設計書・設計図）は入れない。
 * 中身は Worker（devmanage.js：getDevManage・getDevDoc・getUiImage）が本人確認をしてから返す。
 * index.html の renderDevStatusTab から DevManage.render() を呼ぶ。見るだけ（書き込みは無い）。
 */
(function () {
  'use strict';
  const WHO = { '81': '永野', '90': '畑村', '100': '日野', '1002': '江波' };
  const whoName = (w) => WHO[w] || (w ? String(w) : '担当なし');
  // 流れ（2026-11-26 永野さん・江波さんの整理）：受付 → 検討 → 設計 → 機能レビュー → UIレビュー → 本番テスト → 部分リリース → 全体リリース → 定着。
  // 段階は開発状況の各項目の stage で決める（無いときだけ、古い「状態」から仮に決める）。確認者・承認者は決まるまで画面に出さない。
  // 保留は印（hold）で表し、列にしない。mark は「作成中」「本番に出す前」などの一言の印。
  const STAGES = [
    { k: 'inbox', t: '受付', c: '#6b7280', bg: '#eceff3' },
    { k: 'study', t: '検討', c: '#a16207', bg: '#fef3c7' },
    { k: 'design', t: '設計', c: '#2f6fed', bg: '#e8f0ff' },
    { k: 'frev', t: '機能レビュー', c: '#7c4dcc', bg: '#efe8fb' },
    { k: 'urev', t: 'UIレビュー', c: '#a21caf', bg: '#fae8ff' },
    { k: 'prod', t: '本番テスト', c: '#c2410c', bg: '#ffedd5' },
    { k: 'partial', t: '部分リリース', c: '#0f8b8d', bg: '#dff4f4' },
    { k: 'all', t: '全体リリース', c: '#15803d', bg: '#dcfce7' },
    { k: 'settle', t: '定着', c: '#0369a1', bg: '#e0f2fe' },
  ];
  const FLOW = STAGES.map((x) => x.k);
  const oldStage = (s) => (s === 'dev' ? 'design' : (s === 'idea' || s === 'hold') ? 'inbox' : s === 'ready' ? 'frev' : s === 'check' ? 'partial' : 'all');
  const stageOf = (i) => (FLOW.includes(i.stage) ? i.stage : oldStage(i.state));
  const st = { data: null, loading: false, error: '', view: 'board', who: '', area: '', doneAll: false, doc: -1, docs: {}, ui: null, uiLoading: false, tasks: {} };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (d) => (d ? (+d.slice(5, 7)) + '/' + (+d.slice(8, 10)) : '');
  const box = () => document.getElementById('tab-devstatus');

  function css() {
    if (document.getElementById('dm-css')) return;
    const e = document.createElement('style');
    e.id = 'dm-css';
    e.textContent = [
      '.dm{--dmb:var(--border,#e3e6ec);--dms:var(--surface,#fff);--dmt:var(--text,#1f2430);--dmt2:var(--text2,#6b7280);--dmp:var(--primary,#2f6fed)}',
      '.dm-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 12px}.dm-head h2{font-size:1.15em;margin:0}.dm-upd{color:var(--dmt2);font-size:.85em}.dm-sp{flex:1}',
      '.dm-vb{border:0;background:none;padding:6px 14px;font-size:.95em;cursor:pointer;color:var(--dmt2);border-radius:8px}.dm-vb.on{background:var(--dmp);color:#fff;font-weight:700}',
      '.dm-chip{border:1px solid var(--dmb);background:var(--dms);color:var(--dmt2);border-radius:14px;padding:2px 11px;font-size:.82em;cursor:pointer}.dm-chip.on{background:var(--dmt);border-color:var(--dmt);color:var(--dms)}',
      '.dm-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center}.dm-lb{font-size:.82em;color:var(--dmt2)}',
      '.dm-strip{display:flex;gap:18px;flex-wrap:wrap;background:var(--dms);border:1px solid var(--dmb);border-radius:10px;padding:7px 12px;margin-bottom:10px;font-size:.82em;color:var(--dmt2)}.dm-strip b{color:var(--dmt);font-weight:600}',
      '.dm-yw{display:flex;gap:12px;align-items:flex-start}.dm-rail{display:flex;flex-direction:column;gap:6px;width:88px;flex:none}',
      '.dm-rb{border:1px solid var(--dmb);background:var(--dms);border-radius:10px;padding:9px 6px;cursor:pointer;color:var(--dmt);text-align:center}.dm-rb span{display:block;font-size:.78em;color:var(--dmt2)}.dm-rb.on{background:var(--dmt);border-color:var(--dmt);color:var(--dms)}.dm-rb.on span{opacity:.75}',
      '.dm-steps{display:flex;gap:4px;flex-wrap:wrap}.dm-st{flex:1;min-width:70px;text-align:center;font-size:11px;padding:5px 4px;border-radius:6px;background:#eceff3;color:#6b7280}.dm-st.on{background:var(--c);color:#fff;font-weight:700}.dm-st.past{background:#fff;color:var(--c);border:1px solid var(--c)}',
      '.dm-cols{flex:1;min-width:0;display:grid;grid-template-columns:repeat(9,minmax(118px,1fr));gap:8px;align-items:start;overflow-x:auto;padding-bottom:8px}',
      '.dm-col{background:rgba(127,127,127,.10);border-radius:12px;padding:8px;border-top:4px solid var(--c);min-height:100px}',
      '.dm-ch{display:flex;justify-content:space-between;align-items:center;padding:4px 6px 8px;font-size:.9em}.dm-ch i{font-style:normal;background:var(--dms);border-radius:10px;padding:0 8px;font-size:.85em;color:var(--dmt2)}',
      '.dm-card{overflow-wrap:anywhere;background:var(--dms);border:1px solid var(--dmb);border-radius:8px;padding:8px 10px;margin-bottom:8px;cursor:pointer}.dm-card:hover{border-color:var(--dmp)}',
      '.dm-card .t{font-weight:700;font-size:.9em;line-height:1.4;margin-bottom:4px}',
      '.dm-meta{display:flex;gap:5px;flex-wrap:wrap;align-items:center;font-size:.78em;color:var(--dmt2)}.dm-area{border:1px solid var(--dmb);border-radius:6px;padding:0 6px}',
      '.dm-tag{border-radius:6px;padding:0 6px;font-weight:700}',
      '.dm-nx{margin-top:6px;background:var(--bg2);border-radius:8px;padding:5px 9px;font-size:.82em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.dm-nx b{color:var(--c);margin-right:6px}',
      '.dm-c2{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:.8em;margin-top:5px}.dm-cbtn.s{margin-top:0;width:auto;padding:1px 8px;font-size:.78em;font-weight:700;flex:none}',
      '.dm-cbtn{margin-top:8px;width:100%;border:1px solid var(--dmb);background:rgba(47,111,237,.08);color:var(--dmp);border-radius:8px;padding:5px 8px;font-size:.8em;cursor:pointer}',
      '.dm-more{font-size:.85em;color:var(--dmp);cursor:pointer;padding:2px 6px}.dm-empty{color:var(--dmt2);padding:14px;text-align:center;font-size:.85em}',
      '.dm-ov{position:fixed;inset:0;background:rgba(20,24,35,.4);z-index:3000}',
      '.dm-dr{position:fixed;top:0;right:0;bottom:0;width:min(460px,100%);background:var(--dms);color:var(--dmt);z-index:3001;overflow-y:auto;padding:16px 18px;box-shadow:-4px 0 18px rgba(0,0,0,.2)}.dm-dr h2{font-size:1.1em;margin:0 0 6px;line-height:1.4}.dm-dr .x{float:right;border:0;background:none;font-size:22px;cursor:pointer;color:var(--dmt2)}.dm-dr h4{font-size:.8em;color:var(--dmt2);margin:16px 0 6px}',
      '.dm-bx{border:1px solid var(--dmb);border-radius:10px;padding:9px 12px;font-size:.9em}',
      '.dm-dg{font-size:.82em;color:var(--dmt2);font-weight:700;margin:14px 0 6px}.dm-dc{background:var(--dms);border:1px solid var(--dmb);border-radius:10px;padding:10px 14px;margin-bottom:8px;cursor:pointer;display:flex;gap:10px;align-items:center}.dm-dc:hover{border-color:var(--dmp)}.dm-dc .t{font-weight:700}.dm-dc .d{font-size:.82em;color:var(--dmt2)}.dm-dc .v{margin-left:auto;font-size:.78em;color:var(--dmt2);white-space:nowrap}',
      '.dm-doc{background:var(--dms);border:1px solid var(--dmb);border-radius:12px;padding:6px 22px 18px;line-height:1.75}.dm-doc h1{font-size:1.3em}.dm-doc h2{font-size:1.1em;border-bottom:1px solid var(--dmb);padding-bottom:4px;margin-top:24px}.dm-doc h3{font-size:1em}.dm-doc table{border-collapse:collapse;font-size:.85em;margin:8px 0;display:block;overflow-x:auto}.dm-doc td,.dm-doc th{border:1px solid var(--dmb);padding:3px 8px}.dm-doc th{background:rgba(127,127,127,.12)}.dm-doc pre{background:rgba(127,127,127,.12);padding:10px;border-radius:8px;overflow-x:auto;font-size:.85em;line-height:1.4}.dm-doc code{background:rgba(127,127,127,.12);padding:0 4px;border-radius:4px}.dm-doc blockquote{margin:6px 0;padding:2px 12px;border-left:3px solid var(--dmb);color:var(--dmt2)}',
      '.dm-shh{margin:20px 0 0;padding-top:10px;border-top:2px solid var(--dmb);font-weight:700;font-size:.95em}.dm-kv{display:flex;gap:8px;font-size:.88em;margin:4px 0}.dm-kv b{flex:none;width:8.4em;color:var(--dmt2);font-weight:600}.dm-mute{color:var(--dmt2)}.dm-pb{font-weight:600}',
      '.dm-tb{width:100%;border-collapse:collapse;font-size:.8em}.dm-tb th,.dm-tb td{border:1px solid var(--dmb);padding:3px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.dm-tb th{background:var(--bg2,#f3f4f6);white-space:nowrap}.dm-tb td:nth-child(-n+2){white-space:nowrap}',
      '.dm-tk{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:.86em;padding:5px 0;border-bottom:1px solid var(--dmb)}.dm-tk:last-of-type{border-bottom:0}.dm-tkt{font-weight:600}',
      '.dm-pop{position:fixed;inset:2vh 2vw;background:var(--bg,#f6f7f9);color:var(--dmt);border-radius:14px;z-index:3001;display:flex;flex-direction:column;padding:12px 14px;overflow:auto;box-shadow:0 8px 40px rgba(0,0,0,.3)}.dm-ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
      '.dm-cmp{display:grid;grid-template-columns:170px 1fr 1fr;gap:10px;align-items:start}.dm-mn{display:flex;flex-direction:column;gap:5px}.dm-mi{border:1px solid var(--dmb);background:var(--dms);border-radius:10px;padding:8px 10px;font-size:.85em;cursor:pointer;text-align:left;color:var(--dmt)}.dm-mi.on{background:var(--dmt);border-color:var(--dmt);color:var(--dms)}.dm-mi i{font-style:normal;margin-left:6px;font-size:.7em;background:#fff3d6;color:#8a5200;border-radius:6px;padding:0 5px}',
      '.dm-cp{position:relative}.dm-cl{font-weight:700;font-size:.85em;border-left:4px solid var(--c);padding-left:8px;margin-bottom:4px}.dm-cp iframe{width:100%;height:calc(96vh - 215px);min-height:380px;border:1px solid var(--dmb);border-radius:10px;background:#fff}',
      '.dm-ovn{display:none;position:absolute;left:0;right:0;bottom:0;top:26px;background:#f1efe9;border:1px dashed #b9b4a6;border-radius:10px;align-items:center;justify-content:center;text-align:center;color:#6b7280;line-height:1.8}.dm-ovn.on{display:flex}',
      '.dm-spec{width:100%;border-collapse:separate;border-spacing:0;font-size:.85em;background:var(--dms);border:1px solid var(--dmb);border-radius:10px;overflow:hidden}.dm-spec th,.dm-spec td{padding:7px 10px;border-bottom:1px solid var(--dmb);vertical-align:top;text-align:left}.dm-spec thead th{background:rgba(127,127,127,.12);text-align:center}.dm-spec thead th.l{text-align:left}.dm-spec td.c{text-align:center}.dm-spec .gb{border-left:2px solid var(--dmb)}.dm-spec .y{color:#1f8a5b;font-weight:700}.dm-spec .n{color:#a0a6b0}.dm-spec .df{background:#fff3d6;color:#222}.dm-spec .nt{display:block;font-size:.78em;color:var(--dmt2);font-weight:400}.dm-spec tr.dim{opacity:.35}.dm-spec details summary{cursor:pointer}.dm-spec details>div{margin-top:4px;color:var(--dmt2);font-size:.9em}.dm-sph{font-weight:700;margin:16px 0 6px}.dm-spn{font-size:.82em;color:var(--dmt2);margin-bottom:6px}',
      '@media(max-width:900px){.dm-yw{flex-direction:column}.dm-rail{flex-direction:row;width:auto;flex-wrap:wrap}.dm-rb{flex:1}.dm-cmp{grid-template-columns:1fr}.dm-mn{flex-direction:row;flex-wrap:wrap}}',
    ].join('\n');
    document.head.appendChild(e);
  }

  // ===== 読み込み =====
  function render(reload) {
    const b = box(); if (!b) return;
    css();
    if (reload && !st.loading) { st.data = null; st.error = ''; st.docs = {}; st.ui = null; st.tasks = {}; }
    if (!st.data && !st.error && !st.loading) {
      st.loading = true;
      b.innerHTML = '<div class="dm" style="padding:24px;color:var(--text2)">読み込んでいます…</div>';
      api('getDevManage', {}, '', { quiet: true }).then((r) => { st.data = r || {}; }).catch((e) => { st.error = (e && e.message) || '読み込めませんでした'; })
        .finally(() => { st.loading = false; draw(); });
      return;
    }
    draw();
  }
  function items() {
    const s = st.data && st.data.status;
    return ((s && s.items) || []).map((i, n) => ({ id: n, title: i.title, area: i.area, stage: stageOf(i), mark: i.mark || '', hold: i.state === 'hold', chk: i.state === 'check', date: i.date, who: i.who, where: i.where, next: i.next, desc: i.desc || '', act: i.activityId ? String(i.activityId) : '', pri: (i.sheet && i.sheet.priority) || '', sh: i.sheet || null }));
  }
  const filtered = () => items().filter((i) => (!st.who || i.who === st.who) && (!st.area || i.area === st.area));

  // ===== 描画 =====
  function draw() {
    const b = box(); if (!b || st.loading) return;
    if (st.error) { b.innerHTML = '<div class="dm" style="padding:24px"><div style="color:var(--red,#c0392b)">' + esc(st.error) + '</div><p><button class="dm-chip" onclick="DevManage.render(true)">読み直す</button></p></div>'; return; }
    const D = st.data || {}, S = D.status;
    let h = '<div class="dm"><div class="dm-head"><h2>🛠 開発管理</h2><span class="dm-upd">' + (S && S.updated ? '一覧の更新 ' + esc(S.updated) : '') + '</span>'
      + [['board', 'かんばん'], ['docs', '設計書']].map((a) => '<button class="dm-vb ' + (st.view === a[0] ? 'on' : '') + '" onclick="DevManage.view(\'' + a[0] + '\')">' + a[1] + '</button>').join('')
      + '<button class="dm-vb" onclick="DevManage.compare()">◧ ビフォー／アフター比較</button><span class="dm-sp"></span><button class="dm-chip" onclick="DevManage.render(true)">読み直す</button></div>';
    if (st.view === 'docs') { b.innerHTML = h + docsView() + '</div>'; return; }
    const wk = D.worker || {};
    h += '<div class="dm-strip"><span>本番 Worker の最後のデプロイ：<b>' + (wk.deployedAt ? esc(String(wk.deployedAt).slice(0, 16).replace('T', ' ')) : 'わかりません') + '</b></span>'
      + ((S && S.release) || []).map((r) => '<span>' + esc(r.label) + '：<b>' + esc(r.value) + '</b>' + (r.date ? ' ' + md(r.date) : '') + '</span>').join('') + '</div>';
    if (!S) { b.innerHTML = h + '<div class="dm-empty">一覧がまだ置かれていません（schedule-dev の worker で node scripts/devstatus-put.mjs --prod）</div></div>'; return; }
    const all = items(), base = all.filter((i) => !st.area || i.area === st.area);
    const areas = [...new Set(all.map((i) => i.area).filter(Boolean))];
    h += '<div class="dm-chips"><span class="dm-lb">分野</span>' + ['', ...areas].map((a) => '<button class="dm-chip ' + (st.area === a ? 'on' : '') + '" data-a="' + esc(a) + '" onclick="DevManage.area(this.dataset.a)">' + (a ? esc(a) : 'すべて') + '</button>').join('') + '</div>';
    const whos = [...new Set(all.map((i) => i.who).filter(Boolean))];
    const cnt = (w) => (w === '' ? base.length : base.filter((i) => i.who === w).length);
    h += '<div class="dm-yw"><div class="dm-rail"><div class="dm-lb">担当者</div>' + ['', ...whos].map((w) => '<button class="dm-rb ' + (st.who === w ? 'on' : '') + '" data-w="' + esc(w) + '" onclick="DevManage.who(this.dataset.w)">' + (w ? esc(whoName(w)) : '全員') + '<span>' + cnt(w) + '件</span></button>').join('') + '</div><div class="dm-cols">';
    const list = filtered();
    h += STAGES.map((s) => {
      // 列の中は、優先度の高い順（未判定は一番下）。同じ優先度は、一覧の並びのまま
      const RANK = { high: 0, mid: 1, low: 2 };
      const l = list.filter((i) => i.stage === s.k).sort((a, c) => (RANK[a.pri] ?? 3) - (RANK[c.pri] ?? 3)); let show = l, more = '';
      if (s.k === 'all' && l.length > 5) {   // 全体リリースは件数が多いので、新しい5件だけ出して、残りは開く
        const sorted = l.slice().sort((a, c) => (c.date || '').localeCompare(a.date || ''));
        show = st.doneAll ? sorted : sorted.slice(0, 5);
        more = '<div class="dm-more" onclick="DevManage.doneAll()">' + (st.doneAll ? '閉じる' : '古いもの ' + (l.length - 5) + '件を見る') + '</div>';
      }
      return '<div class="dm-col" style="--c:' + s.c + '"><div class="dm-ch"><b>' + s.t + '</b><i>' + l.length + '</i></div>' + (show.map((i) => card(i, s)).join('') || '<div class="dm-empty">なし</div>') + more + '</div>';
    }).join('');
    b.innerHTML = h + '</div></div></div>';
  }
  const tags = (i) => (i.hold ? '<span class="dm-tag" style="background:#fde8e8;color:#9a3b3b">保留</span>' : '')
    + (i.mark ? '<span class="dm-tag" style="background:#fff3d6;color:#8a5200">' + esc(i.mark) + '</span>' : '')
    + (i.chk ? '<span class="dm-tag" style="background:#fff3d6;color:#8a5200">確認待ち</span>' : '');
  // 一覧のカードの表面は簡易版：題名・優先度・担当・開始日→期日・B/F。そのほかは詳細に出す（2026-11-26 永野さん）
  // 開始日・期日は、連動した945の活動の「開始日」「終了日」（Worker の acts）。未連動・未入力は「—」
  function card(i, s) {
    const p = PRI[i.pri], a = ((st.data && st.data.acts) || {})[i.act];
    const dt = a && (a.start || a.end) ? (a.start ? md(a.start) : '—') + ' → ' + (a.end ? md(a.end) : '—') : '日付なし';
    return '<div class="dm-card" style="--c:' + s.c + ';--bg2:' + s.bg + '" onclick="DevManage.open(' + i.id + ')"><div class="t">' + esc(i.title) + '</div>'
      + '<div class="dm-c2"><span>' + (p ? '優先 <span class="dm-tag" style="background:' + p[1] + ';color:' + p[2] + '">' + p[0] + '</span>' : '<span class="dm-mute">優先 未判定</span>') + '</span><span>' + (i.who ? esc(whoName(i.who)) : '') + '</span></div>'
      + '<div class="dm-c2"><span class="dm-mute">' + esc(dt) + '</span><button class="dm-cbtn s" title="ビフォー／アフターを比べる" onclick="event.stopPropagation();DevManage.compare(' + i.id + ')">B/F</button></div></div>';
  }
  function flowHtml(i) {
    const idx = FLOW.indexOf(i.stage);
    return FLOW.map((x, n) => { const t = STAGES.find((y) => y.k === x);
      const cls = x === i.stage ? 'on' : (idx >= 0 && n < idx ? 'past' : '');
      return '<div class="dm-st ' + cls + '" style="--c:' + t.c + '">' + t.t + '</div>'; }).join('');
  }
  function openItem(id) {
    const i = items()[id]; if (!i) return; const s = STAGES.find((x) => x.k === i.stage);
    const el = document.createElement('div'); el.id = 'dm-drw';
    el.innerHTML = '<div class="dm-ov" onclick="DevManage.closeItem()"></div><div class="dm dm-dr"><button class="x" onclick="DevManage.closeItem()">×</button><h2>' + esc(i.title) + '</h2><div class="dm-meta"><span class="dm-tag" style="background:' + s.bg + ';color:' + s.c + '">' + s.t + '</span>'
      + tags(i)
      + (i.area ? '<span class="dm-area">' + esc(i.area) + '</span>' : '') + (i.who ? '<span>担当 ' + esc(whoName(i.who)) + '</span>' : '') + (i.date ? '<span>' + md(i.date) + '</span>' : '') + '</div>'
      + (i.desc ? '<h4>機能の説明</h4><div class="dm-bx">' + esc(i.desc) + '</div>' : '')
      + '<h4>流れ</h4><div class="dm-steps">' + flowHtml(i) + '</div>'
      + (i.where ? '<h4>いまの状態</h4><div class="dm-bx">' + esc(i.where) + '</div>' : '') + (i.next ? '<h4>次にやること</h4><div class="dm-bx">' + esc(i.next) + '</div>' : '')
      + '<div id="dm-tasks">' + tasksBox(i) + '</div>'
      + sheetHtml(i) + '</div>';
    closeItem(); document.body.appendChild(el);
    loadTasks(i);
  }
  // ===== タスク（タスク管理 Kintone 945 の「活動」と連動。見るだけ。追加・更新は945で行う） =====
  const TK_ORDER = { '進行中': 0, '確認待ち': 1, '未着手': 2, '保留': 3, '完了': 4 };
  const TK_COLOR = { '進行中': ['#e8f0ff', '#2f6fed'], '確認待ち': ['#fff3d6', '#8a5200'], '未着手': ['#eceff3', '#6b7280'], '保留': ['#fde8e8', '#9a3b3b'], '完了': ['#e3f6ec', '#1f6b46'] };
  function tasksBox(i) {
    if (!i.act) return '<h4>タスク</h4><div class="dm-bx dm-mute">連動する活動が未設定です（開発状況.json の activityId。タスク管理の活動のレコード番号）</div>';
    const r = st.tasks[i.act];
    if (!r) return '<h4>タスク（タスク管理と連動）</h4><div class="dm-bx dm-mute">読み込んでいます…</div>';
    if (r.error) return '<h4>タスク（タスク管理と連動）</h4><div class="dm-bx dm-mute">' + esc(r.error) + '</div>';
    const ts = (r.tasks || []).slice().sort((a, b) => (TK_ORDER[a.st] ?? 2) - (TK_ORDER[b.st] ?? 2) || (a.end || '9999').localeCompare(b.end || '9999'));
    const open = ts.filter((x) => x.st !== '完了'), done = ts.filter((x) => x.st === '完了').sort((a, b) => (b.done || '').localeCompare(a.done || ''));
    const cnt = ['進行中', '確認待ち', '未着手', '保留'].map((k) => [k, ts.filter((x) => x.st === k).length]).filter((x) => x[1]).map((x) => x[0] + x[1]).concat('完了' + done.length).join('・');
    const row = (x) => { const c = TK_COLOR[x.st] || TK_COLOR['未着手']; const d = x.st === '完了' ? (x.done ? '完了 ' + md(x.done) : '') : (x.end ? '期限 ' + md(x.end) : '');
      return '<div class="dm-tk"><span class="dm-tag" style="background:' + c[0] + ';color:' + c[1] + '">' + esc(x.st) + '</span><span class="dm-tkt">' + esc(x.title) + '</span><span class="dm-mute">' + esc([x.who, d].filter(Boolean).join('・')) + '</span></div>'; };
    const shown = open.concat(done.slice(0, 5));
    return '<h4>タスク（タスク管理の活動「' + esc((r.activity && r.activity.title) || '') + '」と連動）</h4><div class="dm-bx">'
      + (ts.length ? '<div class="dm-mute" style="margin-bottom:4px">' + esc(cnt) + '</div>' + shown.map(row).join('') + (done.length > 5 ? '<div class="dm-mute">ほか完了 ' + (done.length - 5) + '件</div>' : '') : '<span class="dm-mute">この活動の下に、タスクはまだありません</span>')
      + '</div>';
  }
  function loadTasks(i) {
    if (!i.act || st.tasks[i.act]) return;
    api('getDevTasks', { activityId: i.act }, '', { quiet: true })
      .then((r) => { st.tasks[i.act] = r || { tasks: [] }; })
      .catch((e) => { st.tasks[i.act] = { error: (e && e.message) || 'タスクを読み込めませんでした' }; })
      .finally(() => { const el = document.getElementById('dm-tasks'); if (el) el.innerHTML = tasksBox(i); });
  }
  // ===== 設計図の項目（記入シート）。中身は開発状況の sheet（Worker が返す）。書いてあるものだけ出す =====
  const PRI = { high: ['高', '#fde8e8', '#9a3b3b'], mid: ['中', '#fff3d6', '#8a5200'], low: ['低', '#eceff3', '#6b7280'] };
  const kv = (k, v) => (v ? '<div class="dm-kv"><b>' + k + '</b><span>' + esc(v) + '</span></div>' : '');
  function sheetHtml(i) {
    const s = i.sh;
    if (!s) return '<h4>解く問題</h4><div class="dm-bx dm-mute">まだ書かれていません（なぜやるか・誰が確認したか・何を変えたかを残す）</div>';
    const e = s.effect || {}, a = s.after || {}, g = s.gate || {}, f = s.follow || {}, p = PRI[s.priority];
    const sec = (t, body) => (body ? '<h4>' + t + '</h4>' + body : '');
    let h = '<div class="dm-shh">設計図の項目</div>' + (s.draft ? '<div class="dm-bx dm-mute">' + esc(s.draft) + '</div>' : '');
    h += sec('解く問題', s.problem ? '<div class="dm-bx dm-pb">' + esc(s.problem) + '</div>' : '<div class="dm-bx dm-mute">まだ書かれていません</div>');
    h += sec('現状・困りごと', s.now ? '<div class="dm-bx">' + esc(s.now) + '</div>' : '');
    // 優先順位＝成果（会社にとっての成果の量）と難易度（期間＋スキル）で決める。緊急性は例外。未記入は「未判定」と出す
    const hd = s.hard || {}, unk = '<span class="dm-mute">未判定</span>';
    const row = (k, inner) => '<div class="dm-kv"><b>' + k + '</b><span>' + inner + '</span></div>';
    const lvl = (v, why) => (v ? '<span class="dm-tag" style="background:#e8f0ff;color:#2f6fed">' + esc(v) + '</span> ' + esc(why || '') : unk);
    const eff = row('成果', lvl(s.value, s.valueWhy)) + kv('　目標への近さ', e.goal) + kv('　工数削減', e.labor) + kv('　影響範囲', e.scope)
      + row('難易度：期間', hd.period ? esc(hd.period) : unk) + row('難易度：スキル', hd.skill ? esc(hd.skill) : unk)
      + kv('緊急性（例外）', e.urgency)
      + row('優先度', p ? '<span class="dm-tag" style="background:' + p[1] + ';color:' + p[2] + '">' + p[0] + '</span> ' + esc(s.priorityWhy || '') : unk);
    h += sec('成果と難易度（優先順位の根拠）', '<div class="dm-bx">' + eff + '</div>');
    const aft = kv('画面', a.screen) + kv('データ', a.data) + kv('運用・人', a.ops) + kv('やらないこと', a.out);
    h += sec('アフター（作るもの）', aft ? '<div class="dm-bx">' + aft + '</div>' : '');
    const rv = (s.review || []).map((r) => '<tr><td>' + esc(r.kind) + '</td><td>' + esc(r.date) + '</td><td>' + esc(r.who) + '</td><td>' + esc(r.note) + '</td><td>' + esc(r.result) + '</td></tr>').join('');
    h += sec('レビュー記録（先に設計、次にUI）', '<div class="dm-bx">' + (rv ? '<table class="dm-tb"><tr><th>種類</th><th>日付</th><th>確認者</th><th>指摘・直したこと</th><th>結果</th></tr>' + rv + '</table>' : '<span class="dm-mute">まだありません</span>') + '</div>');
    const gt = (g.wide === true ? '全社に影響する' : g.wide === false ? '全社には影響しない' : '') ;
    h += sec('リリース確認', (gt || g.confirmer) ? '<div class="dm-bx">' + kv('全社への影響', gt) + kv('確認者', g.confirmer) + kv('確認日', g.date) + kv('結果', g.result) + '</div>' : '');
    const fl = kv('見直し日', f.when) + kv('解決できたか・効果', f.result) + kv('次にやること', f.next);
    h += sec('定着・フィードバック', fl ? '<div class="dm-bx">' + fl + '</div>' : '');
    const hs = (s.history || []).map((r) => '<tr><td>' + esc(r.v) + '</td><td>' + esc(r.date) + '</td><td>' + esc(r.what) + '</td><td>' + esc(r.why) + '</td><td>' + esc(r.ok) + '</td></tr>').join('');
    h += sec('仕様変更履歴（理由も残す）', hs ? '<div class="dm-bx"><table class="dm-tb"><tr><th>版</th><th>日付</th><th>変更内容</th><th>変更の理由</th><th>確認</th></tr>' + hs + '</table></div>' : '');
    return h;
  }
  function closeItem() { const e = document.getElementById('dm-drw'); if (e) e.remove(); }

  // ===== 設計書 =====
  function inl(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
  function mdToHtml(src) {
    const L = src.split('\n'); let h = '', i = 0, ul = false; const cu = () => { if (ul) { h += '</ul>'; ul = false; } };
    while (i < L.length) {
      const l = L[i];
      if (l.startsWith('```')) { cu(); let b = ''; i++; while (i < L.length && !L[i].startsWith('```')) { b += L[i] + '\n'; i++; } i++; h += '<pre>' + esc(b) + '</pre>'; continue; }
      if (l.startsWith('|') && i + 1 < L.length && /^\|[\s:|-]+\|?$/.test(L[i + 1])) {
        cu(); const hd = l.split('|').slice(1, -1); h += '<table><tr>' + hd.map((c) => '<th>' + inl(c.trim()) + '</th>').join('') + '</tr>'; i += 2;
        while (i < L.length && L[i].startsWith('|')) { h += '<tr>' + L[i].split('|').slice(1, -1).map((c) => '<td>' + inl(c.trim()) + '</td>').join('') + '</tr>'; i++; }
        h += '</table>'; continue;
      }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) { cu(); h += '<h' + m[1].length + '>' + inl(m[2]) + '</h' + m[1].length + '>'; }
      else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (!ul) { h += '<ul>'; ul = true; } h += '<li>' + inl(m[1]) + '</li>'; }
      else if (l.startsWith('>')) { cu(); h += '<blockquote>' + inl(l.replace(/^>\s?/, '')) + '</blockquote>'; }
      else if (/^---+$/.test(l.trim())) { cu(); h += '<hr>'; }
      else if (l.trim() === '') { cu(); }
      else { cu(); h += '<p>' + inl(l) + '</p>'; }
      i++;
    }
    cu(); return h;
  }
  function docsView() {
    const docs = (st.data && st.data.docs) || [];
    if (st.doc >= 0) {
      const d = docs[st.doc], body = st.docs[st.doc];
      return '<p><button class="dm-chip" onclick="DevManage.doc(-1)">← 設計書の一覧へ</button></p><div class="dm-doc">' + (body == null ? '<p>読み込んでいます…</p>' : mdToHtml(body)) + '</div>';
    }
    if (!docs.length) return '<div class="dm-empty">設計書がまだ置かれていません（scripts/devmanage-put.mjs）</div>';
    let h = '', g = '';
    docs.forEach((d) => { if (d.g !== g) { g = d.g; h += '<div class="dm-dg">' + esc(g) + '</div>'; } h += '<div class="dm-dc" onclick="DevManage.doc(' + d.i + ')"><div><div class="t">' + esc(d.f.replace(/_/g, ' ')) + '</div><div class="d">' + esc(d.d) + '</div></div><span class="v">版 ' + esc(d.v) + '</span></div>'; });
    return h;
  }
  function openDoc(i) {
    st.doc = i; draw(); scrollTo(0, 0);
    if (i >= 0 && st.docs[i] == null) api('getDevDoc', { i }, '', { quiet: true }).then((r) => { st.docs[i] = r.md; if (st.doc === i) draw(); }).catch((e) => { st.docs[i] = '読み込めませんでした：' + ((e && e.message) || ''); draw(); });
  }

  // ===== ビフォー／アフター比較（ポップアップ） =====
  const CMENU = [['ホーム', 'home', 'home', ''], ['カレンダー', 'calendar', 'calendar', ''], ['在席・当番', 'team', 'team', ''], ['チャット', null, 'chat', '追加'], ['申請', 'apply', 'apply', ''], ['マイページ', 'mypage', 'mypage', ''], ['設備予約', 'rooms', 'rooms', ''], ['問い合わせ', 'inquiry', 'inquiry', ''], ['タスク', 'tasks', 'tasks', ''], ['eラーニング → 学ぶ・読む', 'elearning', 'learn', '名称変更'], ['設定', 'settings', 'settings', ''], ['管理', 'admin', 'admin', ''], ['経営（役員報告｜経営管理）', 'keiei', 'keiei', '']];
  const AREAMENU = { '在席': 2, '管理': 11, 'チャット': 3, '経営': 12, '設備予約': 6, '申請': 4, '全体': 0, '弁当': 5, '問い合わせ': 7, '勤怠': 0, '通知': 10, 'マイページ': 5, 'タスク': 8 };
  const ROLE_LABEL = { user: '一般の社員', lead: '役職者', admin: '管理者', exec: '役員' };
  const NAV_B = ['home', 'calendar', 'team', 'apply', 'mypage', 'rooms', 'inquiry', 'tasks', 'elearning', 'settings', 'admin', 'keiei'];
  const NAV_A = ['home', 'calendar', 'team', 'chat', 'apply', 'mypage', 'rooms', 'inquiry', 'tasks', 'learn', 'settings', 'admin', 'keiei'];
  const navVis = (after, role) => (after ? NAV_A : NAV_B).filter((k) => (k !== 'elearning' || role !== 'user') && ((k !== 'admin' && k !== 'tasks') || role === 'admin' || role === 'exec') && (k !== 'keiei' || role === 'exec'));
  const MNOTE = { elearning: 'eラーニング', learn: '学ぶ・読む（規程・アンケートも）', inquiry: '準備中' };
  const WHO_E = { 12: ['admin', 'exec'], 14: ['exec'] };
  const cmp = { dev: 'pc', role: 'exec', sync: true, busy: false, loaded: 0, mode: 'screen', roles: ['user', 'exec'], start: null, from: null };
  const cw = (id) => { const f = document.getElementById(id); return f && f.contentWindow; };
  const press = (w, sel) => { const b = w.document.querySelector(sel); if (b) b.click(); };
  function note(m) { const e = document.getElementById('dm-msg'); if (e) { e.textContent = m; clearTimeout(note.t); if (m) note.t = setTimeout(() => { e.textContent = ''; }, 4000); } }

  function openCompare(id) {
    const i = id == null ? null : items()[id];
    closePop(); // 先に閉じる（閉じると飛び先 cmp.start が空になるため、設定はあと）
    cmp.start = i ? (AREAMENU[i.area] == null ? 0 : AREAMENU[i.area]) : 0; cmp.from = i ? i.title : '';
    const el = document.createElement('div'); el.id = 'dm-pop';
    el.innerHTML = '<div class="dm-ov" onclick="DevManage.closePop()"></div><div class="dm dm-pop"><div class="dm-ph"><b>◧ ビフォー／アフター' + (cmp.from ? '：' + esc(cmp.from) : '') + '</b><button class="dm-chip" onclick="DevManage.closePop()">閉じる ×</button></div><div id="dm-mode"></div><div id="dm-body"></div></div>';
    document.body.appendChild(el); modeBar(); renderCmp();
  }
  function closePop() { const e = document.getElementById('dm-pop'); if (e) e.remove(); cmp.start = null; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (document.getElementById('dm-pop')) closePop(); else closeItem(); } });
  function modeBar() { const e = document.getElementById('dm-mode'); if (e) e.innerHTML = '<div class="dm-chips"><button class="dm-chip ' + (cmp.mode === 'screen' ? 'on' : '') + '" onclick="DevManage.mode(\'screen\')">画面を並べる</button><button class="dm-chip ' + (cmp.mode === 'table' ? 'on' : '') + '" onclick="DevManage.mode(\'table\')">比較表（スペック比較）</button></div>'; }
  function renderCmp() {
    const b = document.getElementById('dm-body'); if (!b) return;
    if (cmp.mode === 'table') { b.innerHTML = table(); return; }
    b.innerHTML = '<div id="dm-bar" class="dm-chips"></div><div class="dm-cmp"><div class="dm-mn" id="dm-menu"><div class="dm-lb">メニュー</div>' + CMENU.map((m, i) => '<button class="dm-mi" onclick="DevManage.go(' + i + ')">' + esc(m[0]) + (m[3] ? '<i>' + m[3] + '</i>' : '') + '</button>').join('') + '</div>'
      + '<div class="dm-cp"><div class="dm-cl" style="--c:#6b7280">ビフォー：現状（本番の今）</div><iframe id="dm-fb"></iframe><div class="dm-ovn" id="dm-ovb"></div></div><div class="dm-cp"><div class="dm-cl" style="--c:#2f6fed">アフター：新しい形（チャット入り）</div><iframe id="dm-fa"></iframe></div></div><div class="dm-lb" id="dm-msg" style="min-height:18px;margin-top:6px"></div>';
    bar();
    const go = (html) => {
      cmp.loaded = 0;
      [['dm-fb', 0], ['dm-fa', 1]].forEach(([id, chat]) => {
        const f = document.getElementById(id); if (!f) return;
        f.onload = () => {
          const w = f.contentWindow, d = w.document;
          const s1 = d.createElement('style'); s1.textContent = '.ctl,.note,.xbar{display:none!important}'; d.head.appendChild(s1);
          press(w, '#segMode button[data-v="' + chat + '"]'); press(w, '#segDev button[data-v="' + cmp.dev + '"]'); press(w, '#segRole button[data-v="' + cmp.role + '"]');
          if (++cmp.loaded === 2) { wire(cw('dm-fb'), cw('dm-fa'), 'ビフォー'); wire(cw('dm-fa'), cw('dm-fb'), 'アフター'); hl(); if (cmp.start != null) { go2(cmp.start); cmp.start = null; } }
        };
        f.srcdoc = html;
      });
    };
    if (st.ui) { go(st.ui); return; }
    b.querySelector('.dm-cmp').insertAdjacentHTML('beforebegin', '<div class="dm-empty" id="dm-wait">設計図を読み込んでいます…</div>');
    api('getUiImage', {}, '', { quiet: true }).then((r) => { st.ui = r.html; const w = document.getElementById('dm-wait'); if (w) w.remove(); if (document.getElementById('dm-fb')) go(st.ui); })
      .catch((e) => { const w = document.getElementById('dm-wait'); if (w) w.textContent = '読み込めませんでした：' + ((e && e.message) || ''); });
  }
  function bar() {
    const e = document.getElementById('dm-bar'); if (!e) return;
    const seg = (k, list) => list.map((a) => '<button class="dm-chip ' + (cmp[k] === a[0] ? 'on' : '') + '" onclick="DevManage.set(\'' + k + '\',\'' + a[0] + '\')">' + a[1] + '</button>').join('');
    e.innerHTML = '<span class="dm-lb">端末</span>' + seg('dev', [['pc', 'PC'], ['ph', 'スマホ']]) + '<span class="dm-lb" style="margin-left:10px">見る人</span>' + seg('role', [['user', '一般の社員'], ['lead', '役職者'], ['admin', '管理者'], ['exec', '役員']])
      + '<button class="dm-chip ' + (cmp.sync ? 'on' : '') + '" style="margin-left:10px" onclick="DevManage.sync()">両方そろえて動かす：' + (cmp.sync ? 'オン' : 'オフ') + '</button><button class="dm-chip" onclick="DevManage.reset()">操作をリセット</button>';
  }
  function hl() {
    const b = cw('dm-fb'), a = cw('dm-fa'); if (!b || !a) return;
    const cur = (w) => { try { const x = w.document.querySelector('#side button.on'); return x ? x.dataset.v : null; } catch (e) { return null; } };
    const kb = cur(b), ka = cur(a);
    const ov = document.getElementById('dm-ovb');
    if (ov) { const m = CMENU.find((x) => x[2] === ka && !x[1]); ov.classList.toggle('on', !!m); ov.innerHTML = m ? '<div>ビフォーには<b>「' + esc(m[0]) + '」</b>がありません<br><span style="font-size:.85em">（アフターで追加）</span></div>' : ''; }
    document.querySelectorAll('#dm-menu .dm-mi').forEach((el, i) => { const m = CMENU[i]; el.classList.toggle('on', m[2] === ka || (!m[2] && m[1] === kb)); });
  }
  function go2(i) {
    const m = CMENU[i], miss = []; cmp.busy = true;
    try {
      [[cw('dm-fb'), m[1], 'ビフォー'], [cw('dm-fa'), m[2], 'アフター']].forEach(([w, k, nm]) => {
        if (!w || !k) return; const el = w.document.querySelector('#side [data-a="go"][data-v="' + k + '"]');
        if (!el || el.disabled) { miss.push(nm + 'では、いまの「見る人」には出ません'); return; } el.click();
      });
    } finally { setTimeout(() => { cmp.busy = false; hl(); }, 30); }
    note(miss.join(' ／ '));
  }
  function setOpt(k, v) { cmp[k] = v; ['dm-fb', 'dm-fa'].forEach((id) => { const w = cw(id); if (!w) return; if (k === 'dev') press(w, '#segDev button[data-v="' + v + '"]'); if (k === 'role') press(w, '#segRole button[data-v="' + v + '"]'); }); bar(); setTimeout(hl, 80); }
  function resetBoth() { ['dm-fb', 'dm-fa'].forEach((id) => { const w = cw(id); if (w) press(w, '#btnReset'); }); note('両方の操作をリセットしました'); setTimeout(hl, 80); }
  // 片方の操作を、もう片方でも行う
  function cand(hf, s) { const all = s.a != null ? hf.querySelectorAll('[data-a]') : hf.querySelectorAll(s.tag); return [...all].filter((x) => (s.a != null ? (x.getAttribute('data-a') === s.a && x.getAttribute('data-v') === s.v) : (((x.textContent || '').trim().slice(0, 40)) === s.txt))); }
  function sigOf(w, el) { const hf = w.document.getElementById('hf'); const s = { a: el.getAttribute('data-a'), v: el.getAttribute('data-v'), tag: el.tagName, txt: (el.textContent || '').trim().slice(0, 40) }; s.ord = Math.max(0, cand(hf, s).indexOf(el)); return s; }
  function replay(b, sig, from) {
    const hf = b.document.getElementById('hf'); if (!hf) return;
    if (sig.a === 'go') { const mp = from === 'ビフォー' ? { elearning: 'learn' } : { learn: 'elearning' }; if (mp[sig.v]) sig = Object.assign({}, sig, { v: mp[sig.v] }); }
    const l = cand(hf, sig), t = l[Math.min(sig.ord, l.length - 1)];
    if (!t) { note(from + 'で行った操作（' + (sig.txt || sig.a || '') + '）に当たるものは、もう片方にはありません'); return; }
    cmp.busy = true; try { t.click(); } finally { setTimeout(() => { cmp.busy = false; }, 0); }
  }
  function wire(a, b, name) {
    const d = a.document;
    d.addEventListener('click', (e) => {
      if (cmp.busy || !cmp.sync) return;
      const hf = d.getElementById('hf'); if (!hf) return;
      let el = e.target.closest('[data-a]'); if (!el) el = e.target.closest('button,a,tr,[onclick],summary,li,.row,.card');
      if (!el || !hf.contains(el) || el.closest('.ctl')) return;
      const sig = sigOf(a, el); setTimeout(() => { replay(b, sig, name); setTimeout(hl, 60); }, 0);
    }, true);
    ['input', 'change'].forEach((ev) => d.addEventListener(ev, (e) => {
      if (cmp.busy || !cmp.sync) return; const t = e.target;
      if (!t || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.type === 'checkbox' || t.type === 'radio' || t.closest('.ctl')) return;
      let o = t.id ? b.document.getElementById(t.id) : null; if (!o && t.name) o = b.document.querySelector('[name="' + t.name + '"]');
      if (!o || o.value === t.value) return;
      cmp.busy = true; try { o.value = t.value; o.dispatchEvent(new b.Event(ev, { bubbles: true })); } finally { setTimeout(() => { cmp.busy = false; }, 0); }
    }, false));
  }
  // ===== 比較表（見る人を軸に） =====
  function table() {
    const rs = cmp.roles, EX = (st.data && st.data.expl) || [];
    let h = '<div class="dm-chips"><span class="dm-lb">比べる軸：見る人（選んだ人が横に並びます）</span>' + ['user', 'lead', 'admin', 'exec'].map((r) => '<button class="dm-chip ' + (rs.includes(r) ? 'on' : '') + '" onclick="DevManage.role(\'' + r + '\')">' + ROLE_LABEL[r] + '</button>').join('') + '</div>';
    h += '<div class="dm-sph">① メニューの見え方</div><div class="dm-spn">○＝出る　—＝出ない　黄色＝ビフォーとアフターで違う</div>';
    h += '<table class="dm-spec"><thead><tr><th class="l" rowspan="2">メニュー</th>' + rs.map((r) => '<th colspan="2" class="gb">' + ROLE_LABEL[r] + '</th>').join('') + '</tr><tr>' + rs.map(() => '<th class="gb">ビフォー</th><th>アフター</th>').join('') + '</tr></thead><tbody>';
    CMENU.forEach((m) => {
      h += '<tr><td><b>' + esc(m[0].replace(' → ', ' ／ ')) + '</b></td>' + rs.map((r) => {
        const b = m[1] && navVis(false, r).includes(m[1]), a = m[2] && navVis(true, r).includes(m[2]), df = (!!b !== !!a);
        const cell = (on, k) => (on ? '<span class="y">○</span>' + (MNOTE[k] ? '<span class="nt">' + esc(MNOTE[k]) + '</span>' : '') : '<span class="n">—</span>');
        return '<td class="c gb' + (df ? ' df' : '') + '">' + cell(b, m[1]) + '</td><td class="c' + (df ? ' df' : '') + '">' + cell(a, m[2]) + '</td>';
      }).join('') + '</tr>';
    });
    h += '</tbody></table><div class="dm-sph">② 機能の違い（ビフォー＝現状／アフター＝将来）</div><div class="dm-spn">薄い行は、選んだ「見る人」には出ない変更です。行を押すと全文が開きます。</div>';
    h += '<table class="dm-spec"><thead><tr><th class="l">変更</th><th class="l">ビフォー（現状）</th><th class="l">アフター（将来）</th><th>見る人</th><th>状態</th></tr></thead><tbody>';
    const plain = (s) => String(s || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '');
    const cl = (s) => { const p = plain(s); return p.length > 70 ? '<details><summary>' + esc(p.slice(0, 70)) + '…</summary><div>' + esc(p) + '</div></details>' : esc(p); };
    EX.forEach((x) => { const who = WHO_E[x.id], vis = !who || who.some((r) => rs.includes(r)); h += '<tr' + (vis ? '' : ' class="dim"') + '><td><b>' + esc(x.t) + '</b></td><td>' + cl(x.cur) + '</td><td>' + cl(x.fut) + '</td><td class="c">' + (who ? who.map((r) => ROLE_LABEL[r]).join('・') : '全員') + '</td><td class="c">' + esc(plain(x.state).slice(0, 18)) + '</td></tr>'; });
    return h + '</tbody></table>' + (EX.length ? '' : '<div class="dm-empty">変更の説明がまだ置かれていません（scripts/devmanage-put.mjs）</div>');
  }

  window.DevManage = {
    render,
    view: (v) => { st.view = v; st.doc = -1; draw(); },
    who: (w) => { st.who = w; draw(); },
    area: (a) => { st.area = a; draw(); },
    doneAll: () => { st.doneAll = !st.doneAll; draw(); },
    open: openItem, closeItem,
    doc: openDoc,
    compare: openCompare, closePop,
    mode: (m) => { cmp.mode = m; modeBar(); renderCmp(); },
    go: go2, set: setOpt, reset: resetBoth, sync: () => { cmp.sync = !cmp.sync; bar(); },
    role: (r) => { const i = cmp.roles.indexOf(r); if (i >= 0) { if (cmp.roles.length > 1) cmp.roles.splice(i, 1); } else cmp.roles.push(r); cmp.roles.sort((a, b) => ['user', 'lead', 'admin', 'exec'].indexOf(a) - ['user', 'lead', 'admin', 'exec'].indexOf(b)); renderCmp(); },
  };
})();
