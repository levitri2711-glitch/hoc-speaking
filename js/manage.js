// Từ vựng của tôi (liên thông Học từ vựng), thêm câu hỏi, Giáo viên, Quản trị.
(function () {
  const { Api, html, raw, esc, toast, band, bandClass, fmtDate, CRIT } = HS;
  const App = HSApp;

  // ---------- Từ vựng của tôi ----------
  App.route(/^#\/vocab$/, async () => {
    if (!App.can.learn()) return App.shell('vocab', '<div class="notice">Viewer chưa dùng được mục này.</div>');
    App.loading('vocab');
    let decks = [], due = [], errMsg = '';
    try { [decks, due] = await Promise.all([Api.call('vocabDecks'), Api.call('vocabDue').catch(() => [])]); } catch (e) { errMsg = e.message; }
    const mine = (await App.questions().catch(() => [])).filter((q) => q.custom && /^Từ vựng/.test(q.topic));
    const roots = decks.filter((d) => !d.parent_id);
    const m = App.shell('vocab', html`<div class="narrow"><h1>Luyện Speaking theo từ vựng</h1>
      <p class="muted">Chọn từ bạn đang học trong app <b>Học từ vựng</b> → AI tạo câu hỏi Part 1/2/3 buộc dùng các từ đó → khi chấm có thêm mục "Dùng đúng từ mục tiêu". (Chỉ đọc bộ từ, không thay đổi tiến độ bên app từ vựng.)</p>
      ${errMsg ? html`<div class="notice warn">${errMsg}</div>` : ''}
      ${due.length ? html`<div class="card"><div class="row"><b>Từ đến hạn ôn hôm nay (${due.length})</b><span class="spacer"></span><button class="btn sm" data-pick="due">Dùng các từ này</button></div>
        <p class="small muted">${due.slice(0, 30).map((w) => w.headword).join(', ')}</p></div>` : ''}
      ${roots.length ? html`<div class="card"><label class="field"><span>Hoặc chọn bộ / test</span><select class="input" id="deck"><option value="">— chọn —</option>${roots.map((r) => html`<optgroup label="${r.title}"><option value="${r.deck_id}">${r.title} (cả bộ)</option>${decks.filter((d) => d.parent_id === r.deck_id).map((d) => html`<option value="${d.deck_id}">${d.title} · ${d.word_count} từ</option>`)}</optgroup>`)}</select></label><div id="words"></div></div>` : ''}
      <div id="pickbox"></div>
      ${mine.length ? html`<h2>Câu hỏi đã tạo từ từ vựng</h2><div class="qlist">${mine.map((q) => html`<a class="qrow card" href="#/q/${q.id}"><span class="qtext">${q.text}<small class="muted">Part ${q.part} · ${JSON.parse(q.target_words || '[]').join(', ')}</small></span><span class="bandbadge ${bandClass(q.last_band, App.target())}">${band(q.last_band)}</span></a>`)}</div>` : ''}
    </div>`);
    let pool = [], title = '';
    const pickUI = () => {
      const box = m.querySelector('#pickbox');
      box.innerHTML = html`<div class="card"><div class="row"><b>Chọn tối đa 20 từ</b><span class="spacer"></span><button class="btn sm ghost" id="rand">Chọn ngẫu nhiên 8</button></div>
        <div class="wordpick">${pool.map((w, i) => html`<label title="${w.meaning}"><input type="checkbox" value="${i}"> ${w.headword}</label>`)}</div>
        <div class="row"><label class="small">Số câu <select class="input sm" id="cnt"><option>3</option><option selected>4</option><option>6</option></select></label><span class="spacer"></span><button class="btn primary" id="gen">Tạo câu hỏi (1 lượt AI)</button></div></div>`.__html;
      const boxes = () => [...box.querySelectorAll('input[type=checkbox]')];
      box.querySelector('#rand').onclick = () => { boxes().forEach((b) => { b.checked = false; }); HS.shuffle(boxes()).slice(0, 8).forEach((b) => { b.checked = true; }); };
      box.onchange = () => { const on = boxes().filter((b) => b.checked); if (on.length > 20) { on[on.length - 1].checked = false; toast('Tối đa 20 từ'); } };
      box.querySelector('#gen').onclick = async (e) => {
        const words = boxes().filter((b) => b.checked).map((b) => pool[Number(b.value)]);
        if (!words.length) return toast('Chọn ít nhất 1 từ');
        e.target.disabled = true; e.target.textContent = 'AI đang tạo câu hỏi…';
        try {
          const qs = await Api.call('genVocabQuestions', { words, count: Number(box.querySelector('#cnt').value), deck_title: title });
          App.qs = null;
          toast('Đã tạo ' + qs.length + ' câu');
          location.hash = '#/q/' + qs[0].id;
        } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = 'Tạo câu hỏi (1 lượt AI)'; }
      };
    };
    const dueBtn = m.querySelector('[data-pick=due]');
    if (dueBtn) dueBtn.onclick = () => { pool = due; title = 'đến hạn ôn'; pickUI(); };
    const sel = m.querySelector('#deck');
    if (sel) sel.onchange = async () => {
      if (!sel.value) return;
      try { pool = await Api.call('vocabWords', { deck_id: sel.value }); title = sel.options[sel.selectedIndex].textContent.replace(/ · .*$/, ''); pickUI(); } catch (e) { toast(e.message); }
    };
  });

  // ---------- Thêm câu hỏi ----------
  App.route(/^#\/add$/, () => {
    if (!App.can.learn()) return App.shell('practice', '<div class="notice">Viewer không thêm được câu hỏi.</div>');
    const m = App.shell('practice', html`<div class="narrow"><h1>Thêm câu hỏi</h1>
      <div class="card"><form id="one">
        <div class="row"><label class="field" style="flex:0 0 120px"><span>Part</span><select class="input" name="part"><option>1</option><option>2</option><option>3</option></select></label>
          <label class="field" style="flex:1"><span>Topic</span><input class="input" name="topic" placeholder="VD: Hometown"></label></div>
        <label class="field"><span>Câu hỏi</span><textarea class="input" name="text" rows="2" required></textarea></label>
        <label class="field" id="cuef" hidden><span>Gợi ý cue card (mỗi dòng 1 ý)</span><textarea class="input" name="cue" rows="4" placeholder="who this person is&#10;how you know this person&#10;..."></textarea></label>
        ${App.can.edit() ? html`<label class="row small"><input type="checkbox" name="shared"> Thêm vào ngân hàng chung (mọi học viên thấy)</label>` : html`<p class="small muted">Câu bạn thêm chỉ mình bạn thấy (tab "Câu bạn thêm").</p>`}
        <button class="btn primary">Thêm</button></form></div>
      <h2>Dán cả danh sách</h2>
      <div class="card"><p class="small muted">Dán danh sách câu hỏi (copy từ tài liệu forecast…). AI tách và xếp Part/topic; bạn xem lại rồi mới lưu. Tốn 1 lượt AI.</p>
        <textarea class="input" id="bulk" rows="8"></textarea><p><button class="btn" id="cls">AI xếp Part/topic</button></p><div id="preview"></div></div></div>`);
    const f = m.querySelector('#one');
    f.part.onchange = () => { m.querySelector('#cuef').hidden = f.part.value !== '2'; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await Api.call('addQuestions', { scope: f.shared && f.shared.checked ? 'shared' : 'mine', items: [{ part: Number(f.part.value), topic: f.topic.value, text: f.text.value, cue_points: f.cue.value }] });
        App.qs = null; toast('Đã thêm'); location.hash = '#/q/' + r[0].id;
      } catch (err) { toast(err.message); }
    };
    m.querySelector('#cls').onclick = async (e) => {
      e.target.disabled = true;
      try {
        const items = await Api.call('classifyQuestions', { text: m.querySelector('#bulk').value });
        const pv = m.querySelector('#preview');
        pv.innerHTML = html`<table class="sheet small"><tr><th>Lưu</th><th>Part</th><th>Topic</th><th>Câu hỏi</th></tr>${items.map((q, i) => html`<tr><td><input type="checkbox" checked data-i="${i}"></td><td>${q.part}</td><td>${q.topic}</td><td>${q.text}${(q.cue_points || []).length ? html`<div class="small muted">${q.cue_points.join(' · ')}</div>` : ''}</td></tr>`)}</table>
          <p class="row">${App.can.edit() ? html`<label class="small"><input type="checkbox" id="sh"> Vào ngân hàng chung</label>` : ''}<span class="spacer"></span><button class="btn primary" id="save">Lưu các câu đã chọn</button></p>`.__html;
        pv.querySelector('#save').onclick = async () => {
          const pick = [...pv.querySelectorAll('[data-i]')].filter((c) => c.checked).map((c) => items[Number(c.dataset.i)]);
          try { const r = await Api.call('addQuestions', { scope: pv.querySelector('#sh') && pv.querySelector('#sh').checked ? 'shared' : 'mine', items: pick }); App.qs = null; toast('Đã lưu ' + r.length + ' câu'); location.hash = '#/practice/' + (pv.querySelector('#sh') && pv.querySelector('#sh').checked ? '1' : 'mine'); } catch (err) { toast(err.message); }
        };
      } catch (err) { toast(err.message); }
      e.target.disabled = false;
    };
  });

  // ---------- Giáo viên ----------
  App.route(/^#\/teacher$/, async () => {
    if (!App.can.edit()) return App.shell('teacher', '<div class="notice bad">Chỉ Editor/Owner.</div>');
    App.loading('teacher');
    try {
      const all = location.hash.includes('all');
      const [list, cal] = await Promise.all([Api.call('reviewQueue', {}), Api.call('calibrationStats')]);
      App.shell('teacher', html`<h1>Giáo viên</h1>
        <div class="card small">Độ lệch trung bình AI − Giáo viên (${cal.n} bài đã sửa): ${Object.entries(cal.mean_ai_minus_teacher).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' · ')}
          <div class="muted">Mỗi lần bạn sửa band lệch từ 0.5 trở lên, bài được lưu làm ví dụ hiệu chỉnh để AI chấm sát gu của bạn hơn.</div></div>
        <h2>Bài chờ duyệt (${list.length})</h2>
        ${list.length ? html`<div class="qlist">${list.map((a) => html`<a class="qrow card" href="#/teacher/${a.attempt_id}"><span class="qtext">${a.question_text}<small class="muted">${a.email} · ${fmtDate(a.created_at)} · Part ${a.part}</small></span><span class="bandbadge b-none">${band(a.overall)}</span></a>`)}</div>` : html`<p class="muted">Không có bài mới.</p>`}`);
      void all;
    } catch (e) { App.fail('teacher', e); }
  });
  App.route(/^#\/teacher\/([\w-]+)$/, async (id) => {
    App.loading('teacher');
    try {
      const a = await Api.call('getAttempt', { attempt_id: id });
      const cur = a.review ? a.review.bands : a.bands;
      const m = App.shell('teacher', html`<div class="narrow"><p class="crumbs small"><a href="#/teacher">← Giáo viên</a> · ${a.email} · ${fmtDate(a.created_at)}</p>
        <div class="card qcard"><span class="tag">Part ${a.part}</span><div class="qbig">${a.question_text}</div></div>
        <form class="card" id="rv"><b>Chấm của giáo viên</b>
          <div class="bandgrid">${['FC', 'LR', 'GRA', 'P'].map((c) => html`<label class="field"><span>${CRIT[c]} (AI ${band(a.review ? a.review.ai_bands[c] : a.bands && a.bands[c])})</span><select class="input" name="${c}">${raw(App.bandOptionsAll(cur && cur[c]))}</select></label>`)}</div>
          <label class="field"><span>Nhận xét gửi học viên</span><textarea class="input" name="comment" rows="3">${a.review ? a.review.comment : ''}</textarea></label>
          <button class="btn primary">Lưu & báo học viên</button></form>
        <div id="result"></div></div>`);
      HSResult.render(m.querySelector('#result'), a, { target: 6.5 });
      const f = m.querySelector('#rv');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const bands = {}; ['FC', 'LR', 'GRA', 'P'].forEach((c) => { bands[c] = Number(f[c].value); });
        try { await Api.call('reviewAttempt', { attempt_id: id, bands, comment: f.comment.value }); toast('Đã lưu'); location.hash = '#/teacher'; } catch (err) { toast(err.message); }
      };
    } catch (e) { App.fail('teacher', e); }
  });
  App.bandOptionsAll = (sel) => { let o = ''; for (let b = 9; b >= 0; b -= 0.5) o += `<option value="${b}" ${Number(sel) === b ? 'selected' : ''}>${b.toFixed(1)}</option>`; return o; };

  // ---------- Quản trị ----------
  App.route(/^#\/admin(?:\/(\w+))?$/, async (tab) => {
    if (!App.can.edit()) return App.shell('admin', '<div class="notice bad">Chỉ Editor/Owner.</div>');
    tab = tab || 'users';
    App.loading('admin');
    const nav = html`<div class="seg">${[['users', 'Người dùng'], ['config', 'Cấu hình & AI'], ['questions', 'Câu hỏi'], ['log', 'Nhật ký']].map(([k, l]) => html`<a href="#/admin/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`)}</div>`;
    try {
      if (tab === 'users') return adminUsers(nav);
      if (tab === 'config') return adminConfig(nav);
      if (tab === 'questions') return adminQuestions(nav);
      if (tab === 'log') {
        const rows = await Api.call('auditLog', { limit: 300 });
        App.shell('admin', html`<h1>Quản trị</h1>${nav}<div class="table-wrap"><table class="sheet small"><tr><th>Lúc</th><th>Ai</th><th>Việc</th><th>Đối tượng</th><th>Chi tiết</th></tr>${rows.map((r) => html`<tr><td>${fmtDate(r.at)}</td><td>${r.actor}</td><td>${r.action}</td><td>${r.target}</td><td class="small">${String(r.detail).slice(0, 160)}</td></tr>`)}</table></div>`);
      }
    } catch (e) { App.fail('admin', e); }
  });

  async function adminUsers(nav) {
    const { users, requests } = await Api.call('listUsers');
    const roleOpts = (sel) => (App.can.owner() ? ['viewer', 'learner', 'editor'] : ['viewer', 'learner']).map((r) => `<option value="${r}" ${r === sel ? 'selected' : ''}>${{ viewer: 'Viewer', learner: 'Học viên', editor: 'Editor' }[r]}</option>`).join('');
    const m = App.shell('admin', html`<h1>Quản trị</h1>${nav}
      <div class="card"><b>Mời người dùng</b><form id="inv">
        <label class="field"><span>Email (nhiều email cách nhau dấu phẩy / xuống dòng, tối đa 50)</span><textarea class="input" name="emails" rows="2" required></textarea></label>
        <div class="row"><select class="input sm" name="role" style="width:auto">${raw(roleOpts('learner'))}</select><input class="input sm" name="message" placeholder="Lời nhắn (tuỳ chọn)" style="flex:1"><button class="btn primary">Gửi lời mời</button></div></form><div id="invres"></div></div>
      ${requests.length ? html`<h2>Yêu cầu chờ duyệt</h2>${requests.map((r) => html`<div class="card row"><span>${r.requester}${r.note ? html` <span class="muted small">— ${r.note}</span>` : ''}</span><span class="spacer"></span><select class="input sm" style="width:auto" data-req="${r.requester}">${raw(roleOpts('learner'))}</select><button class="btn sm primary" data-grant="${r.requester}">Cấp</button></div>`)}` : ''}
      <h2>Người dùng (${users.length})</h2>
      <div class="table-wrap"><table class="sheet small"><tr><th>Email</th><th>Quyền</th><th>Trạng thái</th>${App.can.owner() ? html`<th>Lượt chấm/ngày</th>` : ''}<th></th></tr>
        ${users.map((u) => html`<tr><td>${u.email}</td><td>${u.role === 'owner' ? 'Owner' : raw(`<select class="input sm" data-role="${esc(u.email)}">${roleOpts(u.role)}</select>`)}</td><td>${u.status === 'active' ? 'hoạt động' : 'đã thu hồi'}</td>
          ${App.can.owner() ? html`<td>${u.role === 'owner' ? 'không giới hạn' : raw(`<input class="input sm" style="width:90px" data-quota="${esc(u.email)}" placeholder="mặc định">`)}</td>` : ''}
          <td>${u.role !== 'owner' && u.status === 'active' ? raw(`<button class="btn sm danger" data-revoke="${esc(u.email)}">Thu hồi</button>`) : ''}</td></tr>`)}</table></div>`);
    m.querySelector('#inv').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      try {
        const r = await Api.call('inviteUsers', { emails: f.emails.value, role: f.role.value, message: f.message.value });
        const label = { invited: 'đã gửi lời mời', granted: 'đã cấp quyền', granted_no_mail: 'đã cấp quyền (chưa gửi được email)', exists: 'đã có quyền này', invalid: 'email sai', forbidden: 'không đủ quyền' };
        m.querySelector('#invres').innerHTML = html`<ul class="small">${r.results.map((x) => html`<li>${x.email}: ${label[x.status] || x.status}</li>`)}</ul>`.__html;
      } catch (err) { toast(err.message); }
    };
    m.onchange = async (e) => {
      const el = e.target;
      try {
        if (el.dataset.role) { await Api.call('setRole', { email: el.dataset.role, role: el.value }); toast('Đã đổi quyền'); }
        if (el.dataset.quota !== undefined) { await Api.call('setUserQuota', { email: el.dataset.quota, quota: el.value.trim() }); toast('Đã đặt hạn mức'); }
      } catch (err) { toast(err.message); }
    };
    m.onclick = async (e) => {
      const g = e.target.dataset.grant, rv = e.target.dataset.revoke;
      try {
        if (g) { await Api.call('setRole', { email: g, role: m.querySelector(`[data-req="${CSS.escape(g)}"]`).value }); toast('Đã cấp quyền'); App.go(); }
        if (rv && confirm('Thu hồi quyền của ' + rv + '?')) { await Api.call('setRole', { email: rv, role: 'revoke' }); toast('Đã thu hồi'); App.go(); }
      } catch (err) { toast(err.message); }
    };
  }

  async function adminConfig(nav) {
    const [c, u] = await Promise.all([Api.call('getConfig'), Api.call('myUsage')]);
    const own = App.can.owner();
    const row = (k, label, help, type) => html`<label class="field"><span>${label}</span>${type === 'bool'
      ? raw(`<select class="input" name="${k}" ${!own && /ai_|invite|vocab|cap|editor|notify/.test(k) ? 'disabled' : ''}><option value="true" ${c[k] === 'true' ? 'selected' : ''}>Bật</option><option value="false" ${c[k] !== 'true' ? 'selected' : ''}>Tắt</option></select>`)
      : raw(`<input class="input" name="${k}" value="${esc(c[k] || '')}" ${!own && /ai_|invite|vocab|cap|editor/.test(k) ? 'disabled' : ''}>`)}${help ? html`<span class="small muted">${help}</span>` : ''}</label>`;
    const m = App.shell('admin', html`<h1>Quản trị</h1>${nav}
      <div class="stats"><div class="card stat"><span class="small muted">Lượt chấm hôm nay (hệ thống)</span><b>${u.system_used !== undefined ? u.system_used + '/' + (u.system_cap || '∞') : '–'}</b></div>
        <div class="card stat"><span class="small muted">Chấm AI</span><b>${c.ai_enabled === 'true' ? 'Đang bật' : 'Đang tắt'}</b></div><div class="card stat"><span class="small muted">Model</span><b class="small">${c.ai_model}</b></div></div>
      ${c.cost_guard_reason ? html`<div class="notice bad"><b>Cost-guard đã ngắt Gemini:</b> ${c.cost_guard_reason}<br>Kiểm tra dự án Google Cloud của key (không bật thanh toán) trước khi bật lại.</div>` : ''}
      <form class="card" id="cf">
        <h2 style="margin-top:0">Chấm AI (Gemini miễn phí)</h2>
        ${row('ai_enabled', 'Bật chấm AI', 'Tắt = bài vẫn được lưu, vào hàng chờ.', 'bool')}
        ${row('ai_model', 'Model chính', 'Mặc định gemini-2.5-flash')}${row('ai_model_fallback', 'Model dự phòng (khi model chính quá tải)', 'Mặc định gemini-2.5-flash-lite')}
        ${row('system_daily_cap', 'Trần lượt chấm toàn hệ thống / ngày', 'Giữ dưới hạn mức miễn phí của Google. 0 = không giới hạn.')}
        ${row('daily_quota_learner', 'Lượt chấm / ngày mỗi Học viên', 'Đặt riêng từng người ở tab Người dùng.')}${row('daily_quota_editor', 'Lượt chấm / ngày mỗi Editor')}
        ${row('review_examples', 'Số ví dụ hiệu chỉnh của giáo viên đưa vào lời nhắc chấm', '0 = tắt hiệu chỉnh.')}
        <h2>Chung</h2>
        ${row('audio_retention_days', 'Tự xoá file ghi âm sau (ngày)', 'Mặc định 180; kết quả chấm vẫn giữ. 0 = không tự xoá (Drive có thể đầy 15 GB miễn phí).')}
        ${row('default_target_band', 'Band mục tiêu mặc định')}
        ${row('invite_only', 'Thử nghiệm kín (chỉ email được mời mới đăng nhập)', '', 'bool')}${row('notify_editors_on_access', 'Báo cả Editor khi có người xin quyền', '', 'bool')}
        ${row('vocab_spreadsheet_id', 'ID Google Sheets "Học từ vựng – CSDL" (liên thông, chỉ đọc)', 'Lấy trong link: docs.google.com/spreadsheets/d/<ID>/edit')}
        ${row('maintenance', 'Thông báo bảo trì', '', 'bool')}
        <button class="btn primary">Lưu cấu hình</button></form>`);
    m.querySelector('#cf').onsubmit = async (e) => {
      e.preventDefault();
      const values = {};
      [...e.target.elements].forEach((el) => { if (el.name && !el.disabled && String(c[el.name] || '') !== el.value) values[el.name] = el.value; });
      if (!Object.keys(values).length) return toast('Không có thay đổi');
      try { await Api.call('updateConfig', { values }); toast('Đã lưu'); App.go(); } catch (err) { toast(err.message); }
    };
  }

  async function adminQuestions(nav) {
    const qs = await App.questions(true);
    const m = App.shell('admin', html`<h1>Quản trị</h1>${nav}
      <div class="row filters"><select class="input sm" id="fp" style="width:auto"><option value="review">Cần sửa (OCR) — ${qs.filter((q) => q.needs_review).length}</option><option value="">Tất cả</option><option value="1">Part 1</option><option value="2">Part 2</option><option value="3">Part 3</option></select>
        <input class="input sm" id="fx" placeholder="Tìm" style="flex:1"><a class="btn sm" href="#/add">+ Thêm</a></div><div id="ql"></div>`);
    const draw = () => {
      const p = m.querySelector('#fp').value, x = m.querySelector('#fx').value.toLowerCase();
      const list = qs.filter((q) => (p === 'review' ? q.needs_review : !p || String(q.part) === p) && (!x || (q.text + q.topic).toLowerCase().includes(x))).slice(0, 150);
      m.querySelector('#ql').innerHTML = html`${list.map((q) => html`<details class="card qedit"><summary><span class="tag">P${q.part}</span> ${q.text} <small class="muted">· ${q.topic}</small>${q.needs_review ? html` <span class="tag">cần sửa</span>` : ''}</summary>
        <form data-id="${q.id}"><div class="row"><label class="field" style="flex:0 0 90px"><span>Part</span><select class="input" name="part">${[1, 2, 3].map((n) => raw(`<option ${q.part === n ? 'selected' : ''}>${n}</option>`))}</select></label><label class="field" style="flex:1"><span>Topic</span><input class="input" name="topic" value="${q.topic}"></label></div>
        <label class="field"><span>Câu hỏi</span><textarea class="input" name="text" rows="2">${q.text}</textarea></label>
        ${q.part === 2 ? html`<label class="field"><span>Cue (mỗi dòng 1 ý)</span><textarea class="input" name="cue" rows="4">${q.cue_points.join('\n')}</textarea></label>` : ''}
        <div class="row"><label class="small"><input type="checkbox" name="nr" ${q.needs_review ? 'checked' : ''}> Cần sửa (ẩn với học viên)</label><label class="small"><input type="checkbox" name="hid"> Ẩn hẳn</label><span class="spacer"></span><button class="btn sm primary">Lưu</button></div></form></details>`)}
        ${list.length === 150 ? html`<p class="small muted">Hiện 150 câu đầu — lọc thêm để thấy câu khác.</p>` : ''}`.__html;
    };
    m.querySelector('#fp').onchange = draw;
    let tm; m.querySelector('#fx').oninput = () => { clearTimeout(tm); tm = setTimeout(draw, 300); };
    m.querySelector('#ql').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      const fields = { part: Number(f.part.value), topic: f.topic.value, text: f.text.value, needs_review: f.nr.checked, hidden: f.hid.checked };
      if (f.cue) fields.cue_points = f.cue.value.split('\n');
      try { const q = await Api.call('updateQuestion', { id: f.dataset.id, fields }); Object.assign(qs.find((x) => x.id === q.id), q); App.qs = null; toast('Đã lưu'); } catch (err) { toast(err.message); }
    };
    draw();
  }
})();
