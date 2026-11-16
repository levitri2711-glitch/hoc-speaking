// Thi thử full Part 1-2-3: chạy như phòng thi, không hiện điểm giữa chừng, chấm tổng cuối bài.
(function () {
  const { Api, Speech, Recorder, html, raw, toast, band, bandClass, fmtTime, fmtDate, ICON, CRIT, CRIT_EN } = HS;
  const App = HSApp;
  const LIMIT = { 1: 40, 2: 120, 3: 75 };

  App.route(/^#\/test$/, async () => {
    if (!App.can.learn()) return App.shell('test', '<div class="notice">Viewer chưa thi thử được.</div>');
    App.loading('test');
    let tests = [];
    try { tests = await Api.call('myTests'); } catch (e) { /* bỏ qua */ }
    const qs = await App.questions().catch(() => []);
    const quarters = [...new Set(qs.flatMap((q) => String(q.quarters || '').split(',').filter(Boolean)))].sort();
    const open = tests.find((t) => t.status === 'in_progress');
    const m = App.shell('test', html`<div class="narrow"><h1>Thi thử full</h1>
      <div class="card">
        <p>Mô phỏng phòng thi 11–14 phút: <b>Part 1</b> (3 chủ đề, 9–12 câu) → <b>Part 2</b> (1 phút chuẩn bị, nói 1–2 phút) → 1–2 <b>câu hỏi thêm</b> giám khảo đặt theo chính câu chuyện bạn vừa kể (chống học thuộc) → <b>Part 3</b> (4–5 câu thảo luận cùng chủ đề).</p>
        <ul class="small muted"><li>Không hiện điểm giữa chừng; chấm tổng 4 tiêu chí (band nguyên như thi thật) khi nộp bài.</li>
          <li>Thoát giữa chừng thì bài không được chấm.</li><li>Cần nơi yên tĩnh, micro ổn định. Tốn 1 lượt chấm.</li></ul>
        <label class="field"><span>Đề theo quý forecast</span><select class="input" id="qt"><option value="">Ngẫu nhiên mọi quý</option>${quarters.map((x) => html`<option value="${x}">${x.replace('2026Q', 'Quý ')}/2026</option>`)}</select></label>
        <button class="btn primary" id="start">Vào phòng thi</button>
        ${open ? html`<p class="small muted">Bạn có 1 bài thi đang dở (${fmtDate(open.created_at)}) — vào phòng thi mới sẽ huỷ bài đó.</p>` : ''}
      </div>
      ${tests.filter((t) => t.status !== 'in_progress').length ? html`<h2>Bài thi trước</h2><div class="qlist">${tests.filter((t) => t.status !== 'in_progress').map((t) => html`<a class="qrow card" href="#/test/${t.test_id}"><span>${fmtDate(t.created_at)}${t.bands ? html`<small class="muted"> · FC ${t.bands.FC} · LR ${t.bands.LR} · GRA ${t.bands.GRA} · P ${t.bands.P}</small>` : html`<small class="muted"> · ${t.status}</small>`}</span><span class="bandbadge ${bandClass(t.overall, App.target())}">${band(t.overall)}</span></a>`)}</div>` : ''}
    </div>`);
    m.querySelector('#start').onclick = async (e) => {
      e.target.disabled = true;
      try { const t = await Api.call('startTest', { quarter: m.querySelector('#qt').value }); runTest(t); } catch (err) { toast(err.message); e.target.disabled = false; }
    };
  });

  function runTest(t) {
    const steps = [];
    t.plan.part1.forEach((q, i) => steps.push({ q, part: 1, intro: i === 0 ? 'Good morning. In this first part, I\'d like to ask you some questions about yourself. ' : '' }));
    steps.push({ q: t.plan.part2, part: 2, intro: 'Now, I\'m going to give you a topic and I\'d like you to talk about it for one to two minutes. Before you talk, you\'ll have one minute to think about what you\'re going to say. You can make some notes if you wish. ' });
    t.plan.part3.forEach((q, i) => steps.push({ q, part: 3, intro: i === 0 ? 'We\'ve been talking about ' + t.plan.part2.text.replace(/^Describe\s+/i, '').replace(/\.$/, '') + '. I\'d like to discuss with you one or two more general questions related to this. ' : '' }));
    let idx = 0, rec = null, timer = 0;
    const uploads = [];
    let done = false;
    App.leaveGuard = () => (done ? '' : 'Bạn đang thi. Thoát giữa chừng thì bài sẽ không được chấm. Vẫn thoát?');
    App.cleanup = () => { clearInterval(timer); if (rec) rec.cancel(); Speech.stop(); if (!done) Api.call('abandonTest', { test_id: t.test_id }).catch(() => {}); App.leaveGuard = null; };
    const m = App.shell('test', html`<div class="narrow exam"><div class="row"><b id="ptitle"></b><span class="spacer"></span><span class="small muted" id="pcount"></span></div>
      <div class="progress-line"><i id="pl"></i></div><div class="card stage" id="st"></div>
      <p class="small muted center">Đang thi — đừng tải lại trang. <button class="btn sm ghost" id="quit">Thoát (không chấm)</button></p></div>`);
    const st = m.querySelector('#st');
    m.querySelector('#quit').onclick = () => { location.hash = '#/test'; };

    async function step() {
      if (idx >= steps.length) return submit();
      const s = steps[idx];
      m.querySelector('#ptitle').textContent = s.label || 'Part ' + s.part;
      m.querySelector('#pcount').textContent = `Câu ${idx + 1}/${steps.length}`;
      m.querySelector('#pl').style.width = (idx / steps.length * 100) + '%';
      if (s.part === 2) {
        st.innerHTML = html`<div class="cuecard"><b>${s.q.text}</b><p class="small">You should say:</p><ul>${s.q.cue_points.map((c) => html`<li>${c}</li>`)}</ul></div>
          <div class="row"><b>Chuẩn bị</b><span class="spacer"></span><span class="clock" id="clk">1:00</span></div><textarea class="input" rows="4" id="notes" placeholder="Ghi chú"></textarea>
          <p class="center"><button class="btn" id="early">Sẵn sàng nói</button></p>`.__html;
        await Speech.say(s.intro);
        let left = 60;
        await new Promise((resolve) => {
          timer = setInterval(() => { left--; const c = st.querySelector('#clk'); if (c) c.textContent = fmtTime(left); if (left <= 0) { clearInterval(timer); resolve(); } }, 1000);
          st.querySelector('#early').onclick = () => { clearInterval(timer); resolve(); };
        });
        const notes = st.querySelector('#notes').value;
        await Speech.say('All right? Remember you have one to two minutes for this. I\'ll tell you when the time is up. Can you start speaking now, please?');
        return record(s, notes);
      }
      st.innerHTML = html`<p class="center muted">🎧 Giám khảo đang hỏi…</p><p class="center"><button class="btn sm ghost" id="again">Nghe lại câu hỏi</button></p>`.__html;
      st.querySelector('#again').onclick = () => Speech.say(s.q.text);
      await Speech.say(s.intro + s.q.text);
      record(s, '');
    }
    async function record(s, notes) {
      try {
        st.innerHTML = html`${s.part === 2 ? html`<div class="cuecard small"><b>${s.q.text}</b><ul>${s.q.cue_points.map((c) => html`<li>${c}</li>`)}</ul>${notes ? html`<pre class="notes">${notes}</pre>` : ''}</div>` : ''}
          <div class="row"><span class="recdot"></span><b>Đang ghi âm</b><span class="spacer"></span><span class="clock" id="clk">0:00</span></div><div class="meter"><i id="lvl"></i></div>
          <p class="center"><button class="btn primary" id="next">${raw(ICON.stop)} Xong, câu tiếp</button></p>`.__html;
        const lvl = st.querySelector('#lvl');
        rec = await Recorder.start((v) => { lvl.style.width = Math.min(100, v * 160) + '%'; });
        const clk = st.querySelector('#clk');
        timer = setInterval(() => { const sec = rec.seconds(); clk.textContent = fmtTime(sec); if (sec >= LIMIT[s.part]) { clearInterval(timer); next(); } }, 250);
        st.querySelector('#next').onclick = () => { clearInterval(timer); next(); };
      } catch (e) { st.innerHTML = html`<div class="notice bad">Không mở được micro: ${e.message}</div>`.__html; }
      async function next() {
        const r0 = rec; rec = null;
        const { blob, seconds } = await r0.stop();
        if (s.part === 2) await Speech.say('Thank you.');
        // Gửi nền, không chờ — để bài thi chạy liền mạch.
        const up = Recorder.toWav16k(blob).then(({ b64 }) => Api.call('submitAttempt', { question_id: s.q.id, test_id: t.test_id, mode: 'test', audio_b64: b64, mime: 'audio/wav', duration: seconds }))
          .catch((e) => ({ error: e.message, step: s }));
        uploads.push(up);
        if (s.part === 2) {
          // Như thi thật: giám khảo hỏi thêm 1–2 câu dựa trên chính câu chuyện vừa kể (chống học thuộc).
          st.innerHTML = '<p class="center muted"><span class="spin"></span> Giám khảo đang xem lại phần trình bày của bạn…</p>';
          try {
            const a = await up;
            if (a && a.attempt_id) {
              const fu = await Api.call('testFollowUps', { test_id: t.test_id, attempt_id: a.attempt_id });
              steps.splice(idx + 1, 0, ...fu.map((q) => ({ q, part: 3, label: 'Part 2 – câu hỏi thêm', intro: '' })));
            }
          } catch (e) { /* không có câu hỏi thêm thì thi tiếp */ }
        }
        idx++;
        step();
      }
    }
    async function submit() {
      m.querySelector('#pl').style.width = '100%';
      st.innerHTML = '<p class="center">That is the end of the speaking test. Thank you.</p><p class="center muted"><span class="spin"></span> Đang gửi các câu trả lời…</p>';
      Speech.say('That is the end of the speaking test. Thank you.');
      const res = await Promise.all(uploads);
      const bad = res.filter((r) => r && r.error);
      if (bad.length) {
        st.innerHTML = html`<div class="notice bad">${bad.length} câu chưa gửi được (${bad[0].error}). Kiểm tra mạng rồi bấm nộp lại.</div><p class="center"><button class="btn primary" id="retry">Nộp lại</button></p>`.__html;
        st.querySelector('#retry').onclick = () => { st.innerHTML = '<p class="muted center">Bài thi cần ghi âm lại các câu lỗi — bắt đầu bài mới.</p>'; done = true; App.leaveGuard = null; };
        return;
      }
      st.innerHTML = '<p class="center muted"><span class="spin"></span> Giám khảo đang nghe toàn bộ bài thi và chấm (có thể 1–2 phút)…</p>';
      try {
        const g = await Api.call('finishTest', { test_id: t.test_id });
        done = true; App.leaveGuard = null;
        location.hash = '#/test/' + g.test_id;
      } catch (e) {
        done = true; App.leaveGuard = null;
        st.innerHTML = html`<div class="notice bad">${e.message}</div><p>Bài đã lưu; xem lại trong <a href="#/history">Lịch sử</a>.</p>`.__html;
      }
    }
    step();
  }

  // ---------- Kết quả bài thi ----------
  App.route(/^#\/test\/([\w-]+)$/, async (id) => {
    App.loading('test');
    try {
      const t = await Api.call('getTest', { test_id: id });
      const target = App.target();
      const r = t.result;
      const all = t.plan.part1.concat([t.plan.part2], t.plan.part3);
      const ans = (r && r.answers) || [];
      const m = App.shell('test', html`<div class="narrow"><p class="crumbs small"><a href="#/test">← Thi thử</a> · ${fmtDate(t.created_at)}</p>
        ${t.status === 'graded' && r ? html`
          <div class="result-head card"><div class="overall"><span class="small muted">Overall</span><b class="${bandClass(t.overall, target)}-t">${band(t.overall)}</b><span class="small muted">Mục tiêu ${band(target)}</span></div>
            <div class="summary">${r.summary || ''}</div></div>
          <div class="crits">${['FC', 'LR', 'GRA', 'P'].map((c) => { const cr = r.criteria[c] || {}; return html`<details class="crit card"><summary><span class="crit-name">${CRIT[c]}<small>${CRIT_EN[c]}</small></span><span class="bandbadge ${bandClass(cr.band, target)}">${band(cr.band)}</span></summary>
            <div class="crit-body">${(cr.evidence || []).length ? html`<div class="kv"><b>Bằng chứng</b><ul>${cr.evidence.map((e) => html`<li><q>${e}</q></li>`)}</ul></div>` : ''}
            <div class="kv"><b>Điều làm bạn chưa lên band</b><p>${cr.holding_back || ''}</p></div><div class="kv"><b>Để lên band kế tiếp</b><p>${cr.to_next_band || ''}</p></div></div></details>`; })}</div>
          ${(r.strengths || []).length ? html`<div class="card"><b>Điểm mạnh</b><ul>${r.strengths.map((s) => html`<li>${s}</li>`)}</ul></div>` : ''}
          ${(r.next_steps || []).length ? html`<div class="card"><b>Việc nên làm tiếp</b><ol>${r.next_steps.map((s) => html`<li>${s}</li>`)}</ol></div>` : ''}
          <h2>Từng câu</h2>
          ${all.map((q, i) => { const a = ans.find((x) => x.index === i) || {}; const at = t.answers.find((x) => x.question_id === q.id); return html`<div class="card"><span class="tag">Part ${q.part}</span> <b>${q.text}</b>
            <p class="small">${a.transcript || ''}</p>${a.comment ? html`<p class="small muted">${a.comment}</p>` : ''}${(a.key_errors || []).length ? html`<ul class="small">${a.key_errors.map((x) => html`<li>${x}</li>`)}</ul>` : ''}
            ${at ? html`<button class="btn sm" data-aud="${at.attempt_id}">▶ Nghe lại</button> <a class="btn sm" href="#/q/${q.id}">Luyện riêng câu này (chấm chi tiết)</a>` : ''}</div>`; })}
          <p class="small muted">Điểm do AI ước lượng theo band descriptors công khai, chỉ để tham khảo.</p>`
        : html`<div class="notice ${t.status === 'error' || t.status === 'unscorable' ? 'bad' : 'warn'}">${t.status === 'queued' ? 'Bài thi đã nộp và đang chờ chấm (hết lượt hôm nay hoặc Gemini đang bận) — hệ thống tự chấm sau.' : t.error || t.status}</div>`}
      </div>`);
      m.querySelectorAll('[data-aud]').forEach((b) => {
        b.onclick = async () => { try { const au = await Api.call('getAudio', { attempt_id: b.dataset.aud }); const p = document.createElement('audio'); p.controls = true; p.src = HS.b64ToUrl(au.b64, au.mime); b.replaceWith(p); p.play(); } catch (e) { toast(e.message); } };
      });
    } catch (e) { App.fail('test', e); }
  });
})();
