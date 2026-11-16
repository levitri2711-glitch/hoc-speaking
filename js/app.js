// Bộ định tuyến, khung, đăng nhập, lần đầu, trang chủ, cài đặt.
(function () {
  const { Api, LS, Speech, html, raw, esc, toast, band, bandClass } = HS;
  const $app = () => document.getElementById('app');
  const App = {
    user: LS.get('hs.user', null),
    config: LS.get('hs.config', {}),
    qs: null,          // ngân hàng câu hỏi (kèm band gần nhất của mình)
    leaveGuard: null,  // hàm trả về câu hỏi xác nhận khi rời trang (thi thử)
    cleanup: null,
  };
  const can = {
    learn: () => App.user && App.user.role !== 'viewer',
    edit: () => App.user && (App.user.role === 'editor' || App.user.role === 'owner'),
    owner: () => App.user && App.user.role === 'owner',
  };
  App.can = can;
  App.target = () => (App.user && Number(App.user.target_band)) || 6.5;

  // ---------- Khung ----------
  function shell(active, body) {
    const links = [['#/', 'Trang chủ', 'home'], ['#/practice', 'Luyện Forecast', 'practice']];
    if (can.learn()) links.push(['#/test', 'Thi thử', 'test'], ['#/vocab', 'Từ vựng của tôi', 'vocab'], ['#/history', 'Lịch sử', 'history']);
    if (can.edit()) links.push(['#/teacher', 'Giáo viên', 'teacher'], ['#/admin', 'Quản trị', 'admin']);
    links.push(['#/settings', 'Cài đặt', 'settings']);
    $app().innerHTML = `
      <header class="topbar">
        <a class="brand" href="#/">Học speaking</a>
        <nav class="nav" aria-label="Điều hướng chính">${links.map(([h, t, k]) => `<a href="${h}" class="${k === active ? 'active' : ''}">${t}</a>`).join('')}</nav>
      </header>
      <main id="main">${body && body.__html !== undefined ? body.__html : body}</main>`;
    return document.getElementById('main');
  }
  function loading(active) { return shell(active, '<p class="muted">Đang tải…</p>'); }
  function fail(active, e) { shell(active, html`<div class="notice bad">${e.message || e}</div>`); }
  App.shell = shell; App.loading = loading; App.fail = fail;

  async function questions(force) {
    if (!App.qs || force) App.qs = await Api.call('listQuestions', {});
    return App.qs;
  }
  App.questions = questions;
  App.question = async (id) => (await questions()).find((q) => q.id === id) || (await questions(true)).find((q) => q.id === id);

  // ---------- Đăng nhập ----------
  function viewLogin(msg) {
    $app().innerHTML = `
      <main class="narrow" style="padding-top:12vh">
        <h1>Học speaking</h1>
        <p class="muted">Luyện IELTS Speaking theo forecast, nói như phòng thi thật và được chấm chữa cặn kẽ 4 tiêu chí: Trôi chảy, Từ vựng, Ngữ pháp, Phát âm.</p>
        <form id="login" class="card">
          <label class="field"><span>Email của bạn</span><input class="input" type="email" name="email" required autocomplete="email" placeholder="ban@example.com"></label>
          <label class="field" id="notef" hidden><span>Lời nhắn cho quản trị viên (nếu bạn chưa có quyền)</span><input class="input" name="note" maxlength="300" placeholder="Ví dụ: học viên lớp IELTS tối thứ 3"></label>
          <button class="btn primary" style="width:100%">Gửi link đăng nhập</button>
          <p class="small muted" style="margin-bottom:0" id="loginhelp">Không cần mật khẩu. Đang thử nghiệm kín: chỉ email đã được mời mới nhận được link đăng nhập.</p>
        </form>
        <div id="msg">${msg || ''}</div>
        <p class="small muted"><a href="#/legal/privacy">Chính sách bảo mật</a> · <a href="#/legal/terms">Điều khoản</a> · <a href="#/legal/disclaimer">Miễn trừ trách nhiệm</a></p>
      </main>`;
    Api.call('appInfo').then((info) => {
      if (info.invite_only) return;
      document.getElementById('notef').hidden = false;
      document.getElementById('loginhelp').textContent = 'Không cần mật khẩu. Nếu email đã được cấp quyền, bạn sẽ nhận link đăng nhập. Nếu chưa, yêu cầu được gửi tới quản trị viên để duyệt.';
    }).catch(() => {});
    document.getElementById('login').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      const out = document.getElementById('msg');
      try {
        const r = await Api.call('requestLogin', { email: f.get('email'), note: f.get('note') });
        const text = {
          sent: 'Đã gửi link đăng nhập tới email của bạn. Link có hiệu lực 15 phút.',
          requested: 'Đã gửi yêu cầu tới quản trị viên. Bạn sẽ nhận email khi được cấp quyền.',
          pending: 'Yêu cầu của bạn đang chờ quản trị viên duyệt.',
          revoked: 'Quyền truy cập của email này đã bị thu hồi. Liên hệ quản trị viên nếu cần.',
          invite_only: 'Học speaking đang thử nghiệm kín — email này chưa được mời. Hãy nhờ giáo viên gửi lời mời tới email của bạn.',
        }[r.status];
        out.innerHTML = html`<div class="notice ${r.status === 'revoked' || r.status === 'invite_only' ? 'bad' : ''}">${text}</div>`;
      } catch (err) { out.innerHTML = html`<div class="notice bad">${err.message}</div>`; }
      btn.disabled = false;
    };
  }

  async function doLogin(token) {
    $app().innerHTML = '<main class="narrow"><p class="muted">Đang đăng nhập…</p></main>';
    try {
      const r = await Api.call('verifyLogin', { token });
      const prev = LS.get('hs.user', null);
      if (prev && prev.email !== r.user.email) Api.logout();
      Api.setSession(r.session);
      App.user = r.user; LS.set('hs.user', App.user);
      history.replaceState(null, '', location.pathname + '#/');
      await boot();
    } catch (e) { viewLogin(html`<div class="notice bad">${e.message}</div>`); }
  }

  function applyPrefs() {
    const p = (App.user && App.user.prefs) || {};
    Speech.prefs.voice = p.voice || ''; Speech.prefs.rate = Number(p.rate) || 0.95;
  }

  async function boot() {
    try {
      const me = await Api.call('me');
      App.user = me.user; App.config = me.config;
      LS.set('hs.user', App.user); LS.set('hs.config', App.config);
      applyPrefs();
    } catch (e) {
      if (!Api.session) return route();
      toast(e.message);
    }
    route();
  }
  App.refreshMe = async () => { const me = await Api.call('me'); App.user = me.user; App.config = me.config; LS.set('hs.user', App.user); applyPrefs(); };

  // ---------- Lần đầu: band mục tiêu, giọng, điều khoản ----------
  function voiceOptions(sel) {
    const vs = Speech.voices;
    if (!vs.length) return '<option value="">Giọng mặc định của trình duyệt</option>';
    const group = (re, label) => { const g = vs.filter((v) => re.test(v.lang)); return g.length ? `<optgroup label="${label}">${g.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === sel ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</optgroup>` : ''; };
    return '<option value="">Tự chọn (ưu tiên Anh-Anh)</option>' + group(/en[-_]GB/i, 'Anh-Anh') + group(/en[-_]US/i, 'Anh-Mỹ') + group(/en[-_]AU/i, 'Úc') + group(/en[-_](?!GB|US|AU)/i, 'Khác');
  }
  App.voiceOptions = voiceOptions;
  function bandOptions(sel) { let o = ''; for (let b = 4; b <= 9; b += 0.5) o += `<option value="${b}" ${Number(sel) === b ? 'selected' : ''}>${b.toFixed(1)}</option>`; return o; }
  App.bandOptions = bandOptions;

  function viewWelcome() {
    const u = App.user;
    const m = shell('', html`<div class="narrow">
      <h1>Chào bạn 👋</h1>
      <p class="muted">Ba bước nhỏ trước khi luyện. Có thể đổi lại trong Cài đặt.</p>
      <form id="wf" class="card">
        <label class="field"><span>1. Band Speaking mục tiêu</span><select class="input" name="target_band">${raw(bandOptions(u.target_band || 6.5))}</select>
          <span class="small muted">Câu trả lời mẫu sau mỗi lần chấm được viết ở band mục tiêu + 1.</span></label>
        <label class="field"><span>2. Giọng giám khảo</span>
          <div class="row"><select class="input" name="voice" style="flex:1">${raw(voiceOptions(u.prefs.voice))}</select><button type="button" class="btn" id="tryv">Nghe thử</button></div>
          <span class="small muted">Dùng giọng có sẵn của trình duyệt: Chrome là giọng Google, Safari là giọng Apple.</span></label>
        <label class="field"><span>Tốc độ đọc</span><select class="input" name="rate"><option value="0.85">Chậm</option><option value="0.95" selected>Vừa (như phòng thi)</option><option value="1.05">Nhanh</option></select></label>
        <div class="notice warn small">3. <b>Dữ liệu giọng nói:</b> bản ghi âm của bạn được lưu trên Google Drive của giáo viên và gửi tới Google Gemini để chấm điểm. Máy chủ của Google có thể đặt ở nước ngoài (chuyển dữ liệu ra nước ngoài). Ở gói miễn phí, Google có thể dùng dữ liệu gửi lên để cải thiện dịch vụ và người kiểm duyệt của Google có thể nghe/đọc. Không nói thông tin nhạy cảm (số giấy tờ, địa chỉ cụ thể, sức khoẻ…) trong bài. File ghi âm tự xoá sau 180 ngày; bạn có thể xoá từng bài hoặc toàn bộ dữ liệu bất cứ lúc nào.</div>
        <label class="row small"><input type="checkbox" name="age18" required><span>Tôi đủ 18 tuổi trở lên.</span></label>
        <label class="row small" style="align-items:flex-start"><input type="checkbox" name="agree" required><span>Tôi đã đọc <a href="#/legal/terms" target="_blank">Điều khoản</a>, <a href="#/legal/privacy" target="_blank">Chính sách bảo mật</a> và đồng ý cho xử lý dữ liệu cá nhân (email, giọng nói, kết quả chấm) như mô tả ở trên.</span></label>
        <p><button class="btn primary">Bắt đầu luyện</button></p>
      </form></div>`);
    const f = m.querySelector('#wf');
    m.querySelector('#tryv').onclick = () => { Speech.prefs.voice = f.voice.value; Speech.prefs.rate = Number(f.rate.value); Speech.say('Good morning. My name is Sarah and I will be your examiner today. Can you tell me your full name, please?'); };
    setTimeout(() => { if (Speech.voices.length && f.voice.options.length < 3) f.voice.innerHTML = voiceOptions(u.prefs.voice); }, 600);
    f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await Api.call('savePrefs', { target_band: Number(f.target_band.value), voice: f.voice.value, rate: f.rate.value, agreed: true, age18: f.age18.checked });
        await App.refreshMe();
        location.hash = '#/';
      } catch (err) { toast(err.message); }
    };
  }

  // ---------- Trang chủ ----------
  async function viewHome() {
    loading('home');
    try {
      const [usage, stats, qs] = await Promise.all([
        can.learn() ? Api.call('myUsage') : null,
        can.learn() ? Api.call('myStats', {}) : null,
        questions(),
      ]);
      const t = App.target();
      const recent = qs.filter((q) => q.practiced).length;
      const weak = qs.filter((q) => q.last_band !== null && q.last_band < t).slice(0, 5);
      const quota = usage ? (usage.limit ? `${usage.used_today}/${usage.limit}` : `${usage.used_today} (không giới hạn)`) : '–';
      const last = stats && stats.series.length ? stats.series[stats.series.length - 1] : null;
      const counts = [1, 2, 3].map((p) => qs.filter((q) => q.part === p).length);
      shell('home', html`
        <h1>Xin chào${App.user.name ? ', ' + App.user.name : ''}</h1>
        ${usage && !usage.ai_enabled ? html`<div class="notice bad">Chấm AI đang tạm tắt${usage.cost_guard_reason ? ' (cost-guard)' : ''}. Bài bạn nói vẫn được lưu và sẽ được chấm khi bật lại.</div>` : ''}
        ${App.user.role === 'viewer' ? html`<div class="notice">Bạn đang ở quyền <b>Viewer</b>: xem câu hỏi và câu mẫu, chưa ghi âm/chấm được. Nhờ giáo viên nâng lên Học viên để luyện.</div>` : ''}
        ${stats ? html`<div class="stats">
          <div class="card stat"><span class="muted small">Band mục tiêu</span><b>${band(t)}</b></div>
          <div class="card stat"><span class="muted small">Overall tuần này</span><b class="${bandClass(last && last.overall, t)}-t">${band(last && last.overall)}</b></div>
          <div class="card stat"><span class="muted small">Chuỗi ngày luyện</span><b>${stats.streak} 🔥</b></div>
          <div class="card stat"><span class="muted small">Lượt chấm hôm nay</span><b>${quota}</b></div>
        </div>` : ''}
        <h2>Bắt đầu</h2>
        <div class="modes">
          <a class="btn primary" href="#/practice">🎯 Luyện Forecast</a>
          ${can.learn() ? html`<a class="btn" href="#/test">⏱ Thi thử full (11–14 phút)</a><a class="btn" href="#/vocab">📚 Luyện theo từ vựng</a><a class="btn" href="#/history">📈 Tiến bộ của tôi</a>` : ''}
        </div>
        <p class="small muted">Ngân hàng: ${counts[0]} câu Part 1 · ${counts[1]} cue card Part 2 · ${counts[2]} câu Part 3 · bạn đã luyện ${recent} câu.</p>
        ${weak.length ? html`<h2>Nên luyện lại (dưới mục tiêu)</h2><div class="qlist">${weak.map((q) => html`<a class="qrow card" href="#/q/${q.id}"><span class="qtext">${q.text}</span><span class="bandbadge ${bandClass(q.last_band, t)}">${band(q.last_band)}</span></a>`)}</div>` : ''}
        ${stats && stats.top_errors.length ? html`<h2>Lỗi bạn hay lặp lại</h2><div class="card"><ol class="small" style="margin:0;padding-left:20px">${stats.top_errors.map((e) => html`<li>${e.error} <span class="muted">(${e.count} lần)</span></li>`)}</ol></div>` : ''}
      `);
    } catch (e) { fail('home', e); }
  }

  // ---------- Cài đặt ----------
  function viewSettings() {
    const u = App.user;
    const m = shell('settings', html`<div class="narrow">
      <h1>Cài đặt</h1>
      <div class="card">
        <p class="small muted" style="margin-top:0">${u.email} · quyền <b>${u.role_label}</b></p>
        <form id="sf">
          <label class="field"><span>Band mục tiêu</span><select class="input" name="target_band">${raw(bandOptions(u.target_band))}</select></label>
          <label class="field"><span>Giọng giám khảo</span><div class="row"><select class="input" name="voice" style="flex:1">${raw(voiceOptions(u.prefs.voice))}</select><button type="button" class="btn" id="tryv">Nghe thử</button></div></label>
          <label class="field"><span>Tốc độ đọc</span><select class="input" name="rate">${raw(['0.85', '0.95', '1.05'].map((r) => `<option value="${r}" ${String(u.prefs.rate || '0.95') === r ? 'selected' : ''}>${{ '0.85': 'Chậm', '0.95': 'Vừa', '1.05': 'Nhanh' }[r]}</option>`).join(''))}</select></label>
          <button class="btn primary">Lưu</button>
        </form>
      </div>
      <h2>Tài khoản</h2>
      <div class="row"><button class="btn" id="out">Đăng xuất</button>${u.role === 'owner' ? '' : html`<button class="btn danger" id="wipe">Xoá toàn bộ dữ liệu của tôi</button>`}</div>
      ${u.role === 'owner' ? '' : html`<p class="small muted">Rút lại đồng ý: xoá vĩnh viễn mọi bài làm, ghi âm, bài thi, câu hỏi riêng của bạn và khoá tài khoản. Không khôi phục được.</p>`}
      <p class="small muted" style="margin-top:24px"><a href="#/legal/privacy">Bảo mật</a> · <a href="#/legal/terms">Điều khoản</a> · <a href="#/legal/disclaimer">Miễn trừ</a> · <a href="#/legal/complaints">Khiếu nại</a></p>
    </div>`);
    const f = m.querySelector('#sf');
    m.querySelector('#tryv').onclick = () => { Speech.prefs.voice = f.voice.value; Speech.prefs.rate = Number(f.rate.value); Speech.say('Let\'s talk about your hometown. Where is your hometown?'); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await Api.call('savePrefs', { target_band: Number(f.target_band.value), voice: f.voice.value, rate: f.rate.value }); await App.refreshMe(); App.qs = null; toast('Đã lưu'); } catch (err) { toast(err.message); }
    };
    m.querySelector('#out').onclick = () => { Api.logout(); App.user = null; location.hash = '#/'; route(); };
    const w = m.querySelector('#wipe');
    if (w) w.onclick = async () => {
      const c = prompt('Xoá vĩnh viễn toàn bộ dữ liệu và khoá tài khoản. Gõ XOA để xác nhận:');
      if (c !== 'XOA') return;
      try { const r = await Api.call('deleteMyData', { confirm: 'XOA' }); alert('Đã xoá ' + r.attempts + ' bài làm và khoá tài khoản.'); Api.logout(); App.user = null; location.hash = '#/'; route(); } catch (err) { toast(err.message); }
    };
  }

  // ---------- Định tuyến ----------
  const ROUTES = [];
  App.route = (re, fn) => ROUTES.push([re, fn]);
  async function route() {
    if (App.cleanup) { try { App.cleanup(); } catch (e) { /* bỏ qua */ } App.cleanup = null; }
    Speech.stop();
    const h = location.hash || '#/';
    let m;
    if ((m = h.match(/^#\/login\/([0-9a-f]+)/))) return doLogin(m[1]);
    if ((m = h.match(/^#\/legal\/(\w+)/))) return HSLegal.view(m[1], shell, !!(Api.session && App.user));
    if (!Api.session || !App.user) return viewLogin();
    if (!App.user.agreed && h !== '#/welcome') { location.hash = '#/welcome'; return; }
    if (h === '#/welcome') return viewWelcome();
    if (h === '#/' || h === '#') return viewHome();
    if (h === '#/settings') return viewSettings();
    for (const [re, fn] of ROUTES) { const mm = h.match(re); if (mm) return fn(...mm.slice(1).map(decodeURIComponent)); }
    shell('', '<div class="notice bad">Không tìm thấy trang.</div>');
  }
  // Rời trang khi đang thi: hỏi lại.
  let lastHash = location.hash;
  window.addEventListener('hashchange', (e) => {
    if (App.leaveGuard) {
      const msg = App.leaveGuard();
      if (msg && !confirm(msg)) { history.replaceState(null, '', lastHash); return; }
      App.leaveGuard = null;
    }
    lastHash = location.hash;
    route();
  });
  window.addEventListener('beforeunload', (e) => { if (App.leaveGuard && App.leaveGuard()) { e.preventDefault(); e.returnValue = ''; } });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  App.go = route;
  window.HSApp = App;
  window.addEventListener('DOMContentLoaded', () => { if (Api.session) boot(); else route(); });
})();
