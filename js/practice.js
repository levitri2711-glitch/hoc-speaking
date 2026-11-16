// Luyện Forecast, trang luyện 1 câu (Nghe → Chuẩn bị → Trả lời → Chấm), kết quả, shadowing, lịch sử.
(function () {
  const { Api, LS, Speech, Recorder, html, raw, esc, toast, band, bandClass, fmtTime, fmtDate, ICON, CRIT } = HS;
  const App = HSApp;
  const LIMIT = { 1: 45, 2: 120, 3: 90 };
  const PART_NAME = { 1: 'Part 1 – Introduction & interview', 2: 'Part 2 – Long turn (cue card)', 3: 'Part 3 – Discussion' };

  // ---------- Luyện Forecast ----------
  App.route(/^#\/practice(?:\/(\w+))?$/, async (tab) => {
    App.loading('practice');
    tab = tab || LS.get('hs.tab', '1');
    LS.set('hs.tab', tab);
    try {
      const qs = await App.questions();
      const t = App.target();
      const f = LS.get('hs.filter', { quarter: '', status: '', q: '' });
      const quarters = [...new Set(qs.flatMap((q) => String(q.quarters || '').split(',').filter(Boolean)))].sort();
      const inTab = (q) => (tab === 'mine' ? q.custom : !q.custom && String(q.part) === tab);
      const pass = (q) => inTab(q) && (!f.quarter || String(q.quarters).split(',').includes(f.quarter))
        && (!f.status || (f.status === 'new' ? !q.practiced : f.status === 'low' ? q.last_band !== null && q.last_band < t : f.status === 'review' ? q.needs_review : true))
        && (!f.q || (q.text + ' ' + q.topic).toLowerCase().includes(f.q.toLowerCase()));
      const list = qs.filter(pass);
      const topics = [];
      const byTopic = {};
      list.forEach((q) => { if (!byTopic[q.topic]) { byTopic[q.topic] = []; topics.push(q.topic); } byTopic[q.topic].push(q); });
      const sel = LS.get('hs.topic.' + tab, '');
      const cur = byTopic[sel] ? sel : topics[0];
      const m = App.shell('practice', html`
        <div class="row"><h1 style="margin-right:auto">Luyện Forecast</h1>${App.can.learn() ? html`<a class="btn sm" href="#/add">+ Thêm câu hỏi</a>` : ''}</div>
        <div class="seg" role="tablist">${[['1', 'Part 1'], ['2', 'Part 2'], ['3', 'Part 3'], ['mine', 'Câu bạn thêm']].map(([k, l]) => html`<a href="#/practice/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`)}</div>
        <div class="filters row">
          <select class="input sm" id="fq"><option value="">Mọi quý</option>${quarters.map((x) => html`<option value="${x}" ${x === f.quarter ? 'selected' : ''}>${x.replace('2026Q', 'Quý ')}/2026</option>`)}</select>
          <select class="input sm" id="fs"><option value="">Tất cả</option><option value="new" ${f.status === 'new' ? 'selected' : ''}>Chưa luyện</option><option value="low" ${f.status === 'low' ? 'selected' : ''}>Dưới mục tiêu</option>${App.can.edit() ? html`<option value="review" ${f.status === 'review' ? 'selected' : ''}>Cần sửa (OCR)</option>` : ''}</select>
          <input class="input sm" id="fx" placeholder="Tìm câu hỏi / topic" value="${f.q}" style="flex:1;min-width:160px">
        </div>
        ${list.length ? html`<div class="split">
          <aside class="topics" aria-label="Chủ đề">${topics.map((tp) => html`<button class="topic ${tp === cur ? 'on' : ''}" data-tp="${tp}"><span>${tp}</span><small>${byTopic[tp].filter((q) => q.practiced).length}/${byTopic[tp].length}</small></button>`)}</aside>
          <section id="qpane"></section></div>` : html`<p class="muted">Không có câu nào khớp bộ lọc.${tab === 'mine' ? ' Thêm câu riêng ở nút "+ Thêm câu hỏi" hoặc tạo từ bộ từ vựng.' : ''}</p>`}`);
      const save = () => { LS.set('hs.filter', { quarter: m.querySelector('#fq').value, status: m.querySelector('#fs').value, q: m.querySelector('#fx').value }); App.go(); };
      m.querySelector('#fq').onchange = save; m.querySelector('#fs').onchange = save;
      let tm; m.querySelector('#fx').oninput = () => { clearTimeout(tm); tm = setTimeout(save, 400); };
      const pane = m.querySelector('#qpane');
      const show = (tp) => {
        LS.set('hs.topic.' + tab, tp);
        m.querySelectorAll('.topic').forEach((b) => b.classList.toggle('on', b.dataset.tp === tp));
        const qsT = byTopic[tp] || [];
        pane.innerHTML = html`<div class="row"><h2 style="margin:0 auto 0 0">${tp}</h2>${tab !== '2' && App.can.learn() && qsT.length > 1 ? html`<a class="btn sm primary" href="#/q/${qsT[0].id}?topic=1">▶ Luyện cả topic</a>` : ''}</div>
          <div class="qlist">${qsT.map((q) => html`<a class="qrow card" href="#/q/${q.id}">
            <span class="qtext">${q.text}${q.part === 2 && q.cue_points.length ? html`<small class="muted cue">${q.cue_points.join(' · ')}</small>` : ''}
            ${q.needs_review ? html`<small class="tag">cần sửa</small>` : ''}</span>
            <span class="qmeta">${q.last_band !== null ? html`<span class="bandbadge ${bandClass(q.last_band, t)}">${band(q.last_band)}</span>` : ''}<small class="muted">${q.practiced ? `Đã luyện ${q.practiced} lần` : ''}</small></span></a>`)}</div>`.__html;
        if (window.innerWidth < 760) pane.scrollIntoView({ behavior: 'smooth' });
      };
      m.querySelectorAll('.topic').forEach((b) => { b.onclick = () => show(b.dataset.tp); });
      if (cur) show(cur);
    } catch (e) { App.fail('practice', e); }
  });

  // ---------- Trang luyện 1 câu ----------
  // query: topic=1 (luyện liên tiếp cả topic), mode=improve&from=<attempt>
  App.route(/^#\/q\/([\w-]+)(?:\?(.*))?$/, async (id, query) => {
    const params = new URLSearchParams(query || '');
    App.loading('practice');
    let q;
    try { q = await App.question(id); if (!q) throw new Error('Không tìm thấy câu hỏi'); } catch (e) { return App.fail('practice', e); }
    const t = App.target();
    const topicMode = params.get('topic') === '1';
    const improveFrom = params.get('from');
    let improveText = '';
    if (improveFrom) { try { const a = await Api.call('getAttempt', { attempt_id: improveFrom }); improveText = (a.result && a.result.model_answer) || ''; } catch (e) { /* bỏ qua */ } }
    const qsTopic = topicMode ? (await App.questions()).filter((x) => x.topic === q.topic && x.part === q.part && x.custom === q.custom) : [];
    const nextQ = topicMode ? qsTopic[qsTopic.findIndex((x) => x.id === q.id) + 1] : null;
    const m = App.shell('practice', html`<div class="narrow practice">
      <p class="crumbs small"><a href="#/practice/${q.custom ? 'mine' : q.part}">← ${PART_NAME[q.part]}</a> · ${q.topic}${topicMode ? ` · câu ${qsTopic.findIndex((x) => x.id === q.id) + 1}/${qsTopic.length}` : ''}</p>
      <div class="card qcard">
        <div class="row"><span class="tag">Part ${q.part}</span>${improveFrom ? html`<span class="tag owner">Cải thiện câu</span>` : ''}<span class="spacer"></span>
          <button class="icon-btn" id="replay" aria-label="Nghe lại câu hỏi">${raw(ICON.speaker)}</button></div>
        <div id="qtext" class="qbig ${q.part === 2 ? '' : 'blurred'}">${q.text}</div>
        ${q.part === 2 ? html`<div class="cuecard"><b>You should say:</b><ul>${q.cue_points.map((c) => html`<li>${c}</li>`)}</ul></div>` : ''}
        ${q.target_words && q.target_words !== '[]' ? html`<p class="small">Từ mục tiêu: <b>${JSON.parse(q.target_words).join(', ')}</b></p>` : ''}
        <button class="btn sm ghost" id="reveal" ${q.part === 2 ? 'hidden' : ''}>Hiện chữ câu hỏi</button>
      </div>
      ${improveText ? html`<details class="card" open><summary><b>Bản đã sửa để nói lại</b></summary><p class="model">${improveText}</p><button class="btn sm" id="sayimp">${raw(ICON.speaker)} Nghe</button></details>` : ''}
      <div class="phases"><span data-ph="listen">1. Nghe</span><span data-ph="prep">2. Chuẩn bị</span><span data-ph="speak">3. Trả lời</span><span data-ph="grade">4. Chấm</span></div>
      <div id="stage" class="card stage"></div>
      <div id="result"></div>
      <div class="row side-actions">
        <button class="btn" id="samples">💡 Cho mình câu mẫu</button>
        <button class="btn" id="hist">🕘 Lịch sử câu này</button>
        ${nextQ ? html`<a class="btn" href="#/q/${nextQ.id}?topic=1">Câu tiếp theo →</a>` : ''}
      </div>
      <div id="extra"></div>
    </div>`);
    const stage = m.querySelector('#stage');
    const setPhase = (p) => m.querySelectorAll('.phases span').forEach((s) => s.classList.toggle('on', s.dataset.ph === p));
    let rec = null, live = null, timer = 0, notes = '';
    App.cleanup = () => { clearInterval(timer); if (rec) rec.cancel(); if (live) live.stop(); Speech.stop(); };
    m.querySelector('#replay').onclick = () => Speech.say(q.text);
    m.querySelector('#reveal').onclick = (e) => { m.querySelector('#qtext').classList.remove('blurred'); e.target.hidden = true; };
    if (m.querySelector('#sayimp')) m.querySelector('#sayimp').onclick = () => Speech.say(improveText);

    // Câu mẫu: chỉ mở sau khi đã trả lời câu này ít nhất 1 lần (máy chủ kiểm tra).
    m.querySelector('#samples').onclick = async () => {
      const box = m.querySelector('#extra');
      try {
        const s = await Api.call('getSamples', { question_id: q.id });
        box.innerHTML = s.samples.length ? html`<h2>Câu mẫu</h2>${s.samples.map((x, i) => html`<div class="card"><div class="row"><b>Mẫu ${i + 1}</b><span class="spacer"></span><button class="btn sm" data-say="${i}">${raw(ICON.speaker)} Nghe</button></div><p class="model">${x.text}</p></div>`)}`.__html
          : '<p class="muted">Câu này chưa có câu mẫu trong tài liệu. Sau khi chấm, xem câu mẫu viết từ chính ý của bạn ở tab "Đường lên band".</p>';
        box.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => Speech.say(s.samples[Number(b.dataset.say)].text); });
      } catch (e) { box.innerHTML = html`<div class="notice warn">${e.message}</div>`.__html; }
    };
    m.querySelector('#hist').onclick = async () => {
      const box = m.querySelector('#extra');
      try {
        const list = await Api.call('myAttempts', { question_id: q.id });
        box.innerHTML = html`<h2>Lịch sử luyện câu này</h2>${list.length ? html`<div class="qlist">${list.map((a) => html`<a class="qrow card" href="#/a/${a.attempt_id}"><span>${fmtDate(a.created_at)} · ${a.mode === 'improve' ? 'cải thiện' : 'luyện'}
          ${a.bands ? html`<small class="muted"> · FC ${band(a.bands.FC)} · LR ${band(a.bands.LR)} · GRA ${band(a.bands.GRA)} · P ${band(a.bands.P)}</small>` : html`<small class="muted"> · ${a.status}</small>`}</span>
          <span class="bandbadge ${bandClass(a.overall, t)}">${band(a.overall)}</span></a>`)}</div>` : html`<p class="muted">Chưa luyện câu này.</p>`}`.__html;
      } catch (e) { toast(e.message); }
    };

    // Pha 1: Nghe
    async function listen() {
      setPhase('listen');
      stage.innerHTML = '<p class="center muted">🎧 Giám khảo đang đọc câu hỏi…</p>';
      await Speech.say(q.part === 2 ? 'Now, I\'m going to give you a topic and I\'d like you to talk about it for one to two minutes. ' + q.text : q.text);
      if (q.part === 2) prep(); else ready();
    }
    // Pha 2: Chuẩn bị (Part 2: 1 phút + ghi chú)
    function prep() {
      setPhase('prep');
      let left = 60;
      stage.innerHTML = html`<div class="row"><b>Chuẩn bị 1 phút</b><span class="spacer"></span><span class="clock" id="clk">1:00</span></div>
        <textarea class="input" id="notes" rows="4" placeholder="Ghi chú ý chính (chỉ bạn thấy, không chấm)">${LS.get('hs.notes', {})[q.id] || ''}</textarea>
        <p class="center"><button class="btn primary" id="go">Bắt đầu nói ngay</button></p>`.__html;
      const ta = stage.querySelector('#notes');
      ta.oninput = () => { notes = ta.value; const all = LS.get('hs.notes', {}); all[q.id] = ta.value; LS.set('hs.notes', all); };
      timer = setInterval(() => { left--; stage.querySelector('#clk').textContent = fmtTime(left); if (left <= 0) { clearInterval(timer); speak(); } }, 1000);
      stage.querySelector('#go').onclick = () => { clearInterval(timer); speak(); };
    }
    function ready() {
      setPhase('speak');
      if (!App.can.learn()) { stage.innerHTML = '<p class="muted center">Viewer chỉ xem câu hỏi và câu mẫu.</p>'; return; }
      if (!Recorder.supported()) { stage.innerHTML = '<div class="notice bad">Trình duyệt không hỗ trợ ghi âm. Dùng Chrome, Edge hoặc Safari mới.</div>'; return; }
      stage.innerHTML = html`<p class="center"><button class="recbtn" id="rec" aria-label="Bắt đầu ghi âm">${raw(ICON.mic)}</button></p>
        <p class="center small muted">Bấm để trả lời · tối đa ${fmtTime(LIMIT[q.part])}${q.part === 1 ? ' · 2–4 câu là đủ' : q.part === 3 ? ' · nêu ý + lý do + ví dụ' : ''}</p>`.__html;
      stage.querySelector('#rec').onclick = speak;
    }
    // Pha 3: Trả lời (ghi âm + đồng hồ + sóng âm + phụ đề)
    async function speak() {
      setPhase('speak');
      Speech.stop();
      if (!App.can.learn()) return ready();
      try {
        stage.innerHTML = html`<div class="row"><span class="recdot"></span><b>Đang ghi âm</b><span class="spacer"></span><span class="clock" id="clk">0:00</span><span class="muted small">/ ${fmtTime(LIMIT[q.part])}</span></div>
          <div class="meter"><i id="lvl"></i></div>
          ${q.part === 2 && notes ? html`<details class="small"><summary>Ghi chú của bạn</summary><pre class="notes">${notes}</pre></details>` : ''}
          <p class="live small muted" id="live">${Speech.canListen() ? '' : 'Trình duyệt này không có phụ đề tức thời; bài vẫn được chấm bình thường.'}</p>
          <p class="center"><button class="btn primary" id="stop">${raw(ICON.stop)} Dừng & gửi chấm</button> <button class="btn ghost" id="cancel">Huỷ</button></p>`.__html;
        const lvl = stage.querySelector('#lvl');
        rec = await Recorder.start((v) => { lvl.style.width = Math.min(100, v * 160) + '%'; });
        if (LS.get('hs.livecap', true)) live = Speech.listen((txt) => { const el = stage.querySelector('#live'); if (el) el.textContent = txt; });
        const clk = stage.querySelector('#clk');
        timer = setInterval(() => {
          const s = rec.seconds(); clk.textContent = fmtTime(s);
          if (q.part === 2 && s >= 60) clk.classList.add('ok');
          if (s >= LIMIT[q.part]) { clearInterval(timer); finish(); }
        }, 250);
        stage.querySelector('#stop').onclick = () => { clearInterval(timer); finish(); };
        stage.querySelector('#cancel').onclick = () => { clearInterval(timer); rec.cancel(); rec = null; if (live) live.stop(); ready(); };
      } catch (e) {
        stage.innerHTML = html`<div class="notice bad">Không mở được micro: ${e.message}. Kiểm tra quyền micro của trình duyệt (biểu tượng ổ khoá cạnh địa chỉ trang).</div>`.__html;
      }
    }
    async function finish() {
      const r0 = rec; rec = null;
      const capText = live ? live.text() : ''; if (live) { live.stop(); live = null; }
      setPhase('grade');
      stage.innerHTML = '<p class="center muted">Đang xử lý ghi âm…</p>';
      try {
        const { blob, seconds } = await r0.stop();
        if (q.part === 2 && seconds < 60 && !confirm(`Bạn mới nói ${Math.round(seconds)} giây. Part 2 nên nói 1–2 phút; nói dưới 45 giây sẽ bị giới hạn band Trôi chảy. Vẫn gửi chấm?`)) return ready();
        const { b64 } = await Recorder.toWav16k(blob);
        stage.innerHTML = '<p class="center muted">⬆️ Đang gửi bài…</p>';
        const a = await Api.call('submitAttempt', { question_id: q.id, audio_b64: b64, mime: 'audio/wav', duration: seconds, mode: improveFrom ? 'improve' : (q.target_words && q.target_words !== '[]' ? 'vocab' : 'practice'), live_transcript: capText });
        stage.innerHTML = '<p class="center muted"><span class="spin"></span> Giám khảo đang nghe và chấm (thường 15–40 giây)…</p>';
        const g = await Api.call('gradeAttempt', { attempt_id: a.attempt_id });
        App.qs = null;
        stage.classList.add('done');
        stage.innerHTML = html`<div class="row"><b>Đã chấm xong</b><span class="spacer"></span><button class="btn sm" id="again">↻ Trả lời lại</button></div>`.__html;
        stage.querySelector('#again').onclick = () => { stage.classList.remove('done'); m.querySelector('#result').innerHTML = ''; ready(); };
        HSResult.render(m.querySelector('#result'), g, resultOpts(q, g));
        m.querySelector('#result').scrollIntoView({ behavior: 'smooth' });
      } catch (e) {
        stage.innerHTML = html`<div class="notice bad">${e.message}</div><p class="center"><button class="btn" id="retry">Thử lại</button></p>`.__html;
        stage.querySelector('#retry').onclick = ready;
      }
    }
    listen();
  });

  function resultOpts(q, a) {
    return {
      target: App.target(), canDelete: true,
      onRetry: () => { location.hash = '#/q/' + q.id + '?r=' + Date.now(); },
      onImprove: (x) => { location.hash = '#/q/' + q.id + '?from=' + x.attempt_id; },
    };
  }

  // ---------- Xem 1 bài đã chấm ----------
  App.route(/^#\/a\/([\w-]+)$/, async (id) => {
    App.loading('history');
    try {
      const a = await Api.call('getAttempt', { attempt_id: id });
      const m = App.shell('history', html`<div class="narrow"><p class="crumbs small"><a href="#/history">← Lịch sử</a> · ${fmtDate(a.created_at)}</p>
        <div class="card qcard"><span class="tag">Part ${a.part}</span><div class="qbig">${a.question_text}</div><a class="small" href="#/q/${a.question_id}">Luyện lại câu này →</a></div><div id="result"></div></div>`);
      HSResult.render(m.querySelector('#result'), a, { target: App.target(), canDelete: a.email === App.user.email || App.can.owner(), onRetry: () => { location.hash = '#/q/' + a.question_id; }, onImprove: (x) => { location.hash = '#/q/' + a.question_id + '?from=' + x.attempt_id; } });
    } catch (e) { App.fail('history', e); }
  });

  // ---------- Shadowing: nghe từng cụm của câu mẫu → nói theo → so từng từ (Web Speech, không tốn lượt chấm) ----------
  function chunks(text) {
    const out = [];
    String(text).split(/(?<=[.!?;,:])\s+/).forEach((seg) => {
      const w = seg.split(/\s+/).filter(Boolean);
      const n = Math.ceil(w.length / 9), size = Math.ceil(w.length / n); // chia đều, tránh cụm cụt 1 từ
      for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(' '));
    });
    return out.filter(Boolean);
  }
  const normW = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');
  function compare(target, said) {
    const sw = said.split(/\s+/).map(normW).filter(Boolean);
    const used = new Array(sw.length).fill(false);
    return target.split(/\s+/).map((w) => {
      const n = normW(w); const i = sw.findIndex((x, k) => !used[k] && x === n);
      if (i >= 0) used[i] = true;
      return { w, ok: i >= 0 || !n };
    });
  }
  App.route(/^#\/shadow\/([\w-]+)$/, async (id) => {
    App.loading('history');
    try {
      const a = await Api.call('getAttempt', { attempt_id: id });
      const text = (a.result && a.result.model_answer) || '';
      if (!text) throw new Error('Bài này chưa có câu mẫu để shadowing');
      const parts = chunks(text);
      let i = 0, live = null;
      const m = App.shell('history', html`<div class="narrow"><p class="crumbs small"><a href="#/a/${id}">← Kết quả</a></p><h1>Shadowing</h1>
        <p class="muted small">Nghe từng cụm, nói theo ngay, bắt chước nhịp, nhấn và ngữ điệu. Máy so từng từ bạn nói (dùng nhận giọng nói của trình duyệt, không tốn lượt chấm).</p>
        <div class="progress-line"><i id="pl"></i></div><div class="card stage" id="sh"></div>
        <div class="card small" id="all"></div></div>`);
      const all = m.querySelector('#all');
      const results = [];
      const drawAll = () => { all.innerHTML = parts.map((p, k) => results[k] ? results[k].map((x) => `<span class="${x.ok ? 'w-ok' : 'w-bad'}">${esc(x.w)}</span>`).join(' ') : `<span class="muted">${esc(p)}</span>`).join(' / '); };
      App.cleanup = () => { if (live) live.stop(); };
      const show = () => {
        m.querySelector('#pl').style.width = (i / parts.length * 100) + '%';
        drawAll();
        if (i >= parts.length) {
          const tot = results.flat(); const ok = tot.filter((x) => x.ok).length;
          m.querySelector('#sh').innerHTML = html`<p class="center"><b>Xong!</b> Khớp ${ok}/${tot.length} từ (${Math.round(ok / Math.max(1, tot.length) * 100)}%).</p><p class="center"><button class="btn" id="redo">Làm lại</button> <a class="btn primary" href="#/q/${a.question_id}?from=${id}">Nói lại cả câu để chấm</a></p>`.__html;
          m.querySelector('#redo').onclick = () => { i = 0; results.length = 0; show(); };
          return;
        }
        m.querySelector('#sh').innerHTML = html`<p class="qbig">${parts[i]}</p><div class="row center"><button class="btn" id="hear">${raw(ICON.speaker)} Nghe</button><button class="btn" id="slow">Nghe chậm</button>
          <button class="btn primary" id="say" ${Speech.canListen() ? '' : 'disabled'}>${raw(ICON.mic)} Nói theo</button><button class="btn ghost" id="skip">Bỏ qua</button></div><p class="small muted center" id="heard">${Speech.canListen() ? '' : 'Trình duyệt không hỗ trợ nhận giọng nói — dùng Chrome hoặc Safari.'}</p>`.__html;
        Speech.say(parts[i]);
        m.querySelector('#hear').onclick = () => Speech.say(parts[i]);
        m.querySelector('#slow').onclick = () => Speech.say(parts[i], 0.7);
        m.querySelector('#skip').onclick = () => { results[i] = compare(parts[i], ''); i++; show(); };
        m.querySelector('#say').onclick = (e) => {
          if (live) { live.stop(); return; }
          Speech.stop();
          e.target.textContent = '■ Dừng';
          let said = '';
          live = Speech.listen((txt) => { said = txt; m.querySelector('#heard').textContent = txt; });
          setTimeout(() => { if (live) { live.stop(); } }, 4000 + parts[i].split(' ').length * 700);
          const origStop = live.stop;
          live.stop = () => { origStop(); live = null; results[i] = compare(parts[i], said); i++; setTimeout(show, 300); };
        };
      };
      show();
    } catch (e) { App.fail('history', e); }
  });

  // ---------- Lịch sử & tiến bộ ----------
  function chart(series, target) {
    if (series.length < 1) return '<p class="muted small">Chưa đủ dữ liệu để vẽ biểu đồ.</p>';
    const W = 640, H = 220, P = 32, n = series.length;
    const x = (i) => P + (n === 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (n - 1));
    const y = (b) => H - P - (Math.max(3, Math.min(9, b)) - 3) / 6 * (H - 2 * P);
    const keys = [['overall', 'var(--accent)', 'Overall'], ['FC', '#0ea5e9', 'FC'], ['LR', '#16a34a', 'LR'], ['GRA', '#ca8a04', 'GRA'], ['P', '#db2777', 'P']];
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Band theo tuần">`;
    for (let b = 3; b <= 9; b++) svg += `<line x1="${P}" x2="${W - P}" y1="${y(b)}" y2="${y(b)}" class="grid"/><text x="4" y="${y(b) + 4}" class="axis">${b}</text>`;
    svg += `<line x1="${P}" x2="${W - P}" y1="${y(target)}" y2="${y(target)}" class="target"/>`;
    keys.forEach(([k, c]) => {
      svg += `<polyline fill="none" stroke="${c}" stroke-width="${k === 'overall' ? 3 : 1.5}" points="${series.map((s, i) => x(i) + ',' + y(s[k])).join(' ')}"/>`;
      series.forEach((s, i) => { svg += `<circle cx="${x(i)}" cy="${y(s[k])}" r="${k === 'overall' ? 4 : 2.5}" fill="${c}"><title>${s.week}: ${k} ${s[k]}</title></circle>`; });
    });
    series.forEach((s, i) => { if (n <= 8 || i % Math.ceil(n / 8) === 0) svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="axis">${s.week.slice(5)}</text>`; });
    svg += '</svg>';
    return svg + `<div class="legend">${keys.map(([k, c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}<span><i style="background:none;border-top:2px dashed var(--muted);height:0"></i>Mục tiêu</span></div>`;
  }
  App.route(/^#\/history$/, async () => {
    App.loading('history');
    try {
      const [list, st, tests] = await Promise.all([Api.call('myAttempts', { limit: 300 }), Api.call('myStats', {}), Api.call('myTests')]);
      const t = App.target();
      App.shell('history', html`<h1>Tiến bộ của tôi</h1>
        <div class="stats"><div class="card stat"><span class="muted small">Bài đã chấm</span><b>${st.attempts}</b></div><div class="card stat"><span class="muted small">Chuỗi ngày</span><b>${st.streak} 🔥</b></div>
          <div class="card stat"><span class="muted small">Bài thi thử</span><b>${tests.length}</b></div><div class="card stat"><span class="muted small">Mục tiêu</span><b>${band(t)}</b></div></div>
        <h2>Band theo tuần</h2><div class="card">${raw(chart(st.series, t))}</div>
        ${st.top_errors.length ? html`<h2>Lỗi lặp lại nhiều nhất</h2><div class="card"><ol class="small" style="margin:0;padding-left:20px">${st.top_errors.map((e) => html`<li>${e.error} <span class="muted">(${e.count} lần)</span></li>`)}</ol></div>` : ''}
        ${tests.length ? html`<h2>Thi thử</h2><div class="qlist">${tests.map((x) => html`<a class="qrow card" href="#/test/${x.test_id}"><span>${fmtDate(x.created_at)} · ${({ in_progress: 'đang làm', queued: 'chờ chấm', graded: 'đã chấm', error: 'lỗi', unscorable: 'không chấm được' })[x.status] || x.status}</span><span class="bandbadge ${bandClass(x.overall, t)}">${band(x.overall)}</span></a>`)}</div>` : ''}
        <h2>Các lần luyện</h2>
        ${list.length ? html`<div class="qlist">${list.map((a) => html`<a class="qrow card" href="#/a/${a.attempt_id}"><span class="qtext">${a.question_text}<small class="muted">${fmtDate(a.created_at)} · Part ${a.part}${a.mode === 'test' ? ' · thi thử' : a.mode === 'improve' ? ' · cải thiện' : ''}${a.reviewed ? ' · ✔ GV duyệt' : ''}${a.status !== 'done' ? ' · ' + a.status : ''}</small></span>
          <span class="bandbadge ${bandClass(a.overall, t)}">${band(a.overall)}</span></a>`)}</div>` : html`<p class="muted">Chưa có bài nào. <a href="#/practice">Luyện câu đầu tiên →</a></p>`}`);
    } catch (e) { App.fail('history', e); }
  });

  App.PART_NAME = PART_NAME; App.LIMIT = LIMIT;
})();
