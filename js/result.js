// Hiển thị kết quả chấm 1 câu (dùng chung: luyện câu, lịch sử, giáo viên).
(function () {
  const { Api, Speech, html, raw, esc, toast, band, bandClass, b64ToUrl, CRIT, CRIT_EN, ICON } = HS;
  const ERR_LABEL = { grammar: 'Ngữ pháp', vocab: 'Từ vựng', collocation: 'Collocation', word_choice: 'Chọn từ', pron: 'Phát âm', coherence: 'Mạch lạc' };
  const PRON_LABEL = { final_sound: 'Âm cuối', word_stress: 'Trọng âm', vowel: 'Nguyên âm', consonant: 'Phụ âm', linking: 'Nối âm', intonation: 'Ngữ điệu', other: 'Khác' };

  // Tô lỗi trong transcript: tìm đúng cụm trích (không phân biệt hoa thường), bọc <mark>.
  function markTranscript(text, errors) {
    let out = esc(text || '');
    (errors || []).forEach((e, i) => {
      const q = esc(String(e.quote || '').trim());
      if (q.length < 2) return;
      const idx = out.toLowerCase().indexOf(q.toLowerCase());
      if (idx < 0) return;
      out = out.slice(0, idx) + `<mark class="err" data-i="${i}" tabindex="0">` + out.slice(idx, idx + q.length) + `<sup>${i + 1}</sup></mark>` + out.slice(idx + q.length);
    });
    return out.replace(/\[pause[^\]]*\]/gi, (m) => `<span class="pause">${m}</span>`);
  }

  function critCard(c, crit, target, teacher) {
    const b = teacher ? teacher.bands[c] : crit.band;
    return html`<details class="crit card">
      <summary><span class="crit-name">${CRIT[c]}<small>${CRIT_EN[c]}</small></span>
        <span class="bandbadge ${bandClass(b, target)}">${band(b)}</span>${teacher && teacher.bands[c] !== crit.band ? html`<span class="small muted">AI: ${band(crit.band)}</span>` : ''}</summary>
      <div class="crit-body">
        ${crit.evidence && crit.evidence.length ? html`<div class="kv"><b>Bằng chứng</b><ul>${crit.evidence.map((e) => html`<li><q>${e}</q></li>`)}</ul></div>` : ''}
        ${crit.descriptor ? html`<div class="kv"><b>Khớp band descriptor</b><p class="small">${crit.descriptor}</p></div>` : ''}
        ${crit.holding_back ? html`<div class="kv"><b>Điều làm bạn chưa lên band</b><p>${crit.holding_back}</p></div>` : ''}
        ${crit.to_next_band ? html`<div class="kv"><b>Để lên band kế tiếp</b><p>${crit.to_next_band}</p></div>` : ''}
      </div></details>`;
  }

  // a = attemptView(full). opts: { target, onRetry, onImprove, showSamples, audio: true }
  function render(el, a, opts) {
    opts = opts || {};
    const target = opts.target || 6.5;
    const r = a.result;
    if (!r || a.status !== 'done') {
      const msg = { queued: a.error || 'Bài đang chờ chấm.', error: a.error || 'Chấm lỗi.', unscorable: (r && r.unscorable_reason) || a.error || 'Không chấm được bài này.', test_pending: 'Bài thi được chấm khi nộp cả bài.' }[a.status] || a.status;
      el.innerHTML = html`<div class="notice ${a.status === 'unscorable' || a.status === 'error' ? 'bad' : 'warn'}">${msg}</div>
        ${r && r.transcript ? html`<div class="card"><b>Nghe được:</b> ${r.transcript}</div>` : ''}
        ${a.status === 'unscorable' ? html`<p class="small muted">Lượt này không bị trừ. Hãy kiểm tra micro, nói rõ và đủ dài rồi thử lại.</p>` : ''}
        <div class="row" id="ractions"></div>`.__html;
      actions(el, a, opts);
      return;
    }
    const teacher = a.review;
    const overall = a.overall;
    const m = r.metrics || {};
    el.innerHTML = html`
      <div class="result-head card">
        <div class="overall"><span class="small muted">Overall</span><b class="${bandClass(overall, target)}-t">${band(overall)}</b>
          <span class="small muted">Mục tiêu ${band(target)}</span></div>
        <div class="summary">${r.summary || ''}
          ${teacher ? html`<div class="teacher-note"><b>✔ Giáo viên đã duyệt</b>${teacher.comment ? html`: ${teacher.comment}` : ''} <span class="small muted">(AI chấm ${band(teacher.ai_overall)})</span></div>` : ''}
          <div class="metrics small muted">${m.duration_sec ? `${Math.round(m.duration_sec)} giây · ` : ''}${m.words ? `${m.words} từ · ` : ''}${m.wpm ? `${Math.round(m.wpm)} từ/phút · ` : ''}${m.long_pauses !== undefined ? `${m.long_pauses} lần ngập ngừng dài · ` : ''}${m.fillers !== undefined ? `${m.fillers} từ đệm · ` : ''}${m.self_corrections !== undefined ? `${m.self_corrections} lần tự sửa` : ''}</div>
        </div>
      </div>
      <div class="crits">${['FC', 'LR', 'GRA', 'P'].map((c) => critCard(c, r.criteria[c] || {}, target, teacher))}</div>
      <div class="tabs" role="tablist">
        <button class="tab on" data-t="fix">Sửa lỗi (${(r.errors || []).length})</button>
        <button class="tab" data-t="pron">Phát âm (${((r.pronunciation || {}).words || []).length})</button>
        <button class="tab" data-t="up">Đường lên band</button>
        ${r.target_words && r.target_words.length ? html`<button class="tab" data-t="tw">Từ mục tiêu</button>` : ''}
      </div>
      <section class="tabpane" data-p="fix">
        <div class="card transcript">${raw(markTranscript(r.transcript, r.errors))}</div>
        <ol class="errlist">${(r.errors || []).map((e, i) => html`<li id="err${i}"><span class="tag">${ERR_LABEL[e.type] || e.type}</span> <s>${e.quote}</s> → <b>${e.fix}</b><div class="small muted">${e.explain}</div></li>`)}</ol>
        ${(r.errors || []).length ? '' : html`<p class="muted">Không phát hiện lỗi đáng kể.</p>`}
      </section>
      <section class="tabpane" data-p="pron" hidden>
        ${(r.pronunciation || {}).prosody ? html`<div class="card"><b>Ngữ điệu, nhấn câu, nhịp:</b> ${r.pronunciation.prosody}</div>` : ''}
        <div class="pronlist">${((r.pronunciation || {}).words || []).map((w) => html`<div class="pron card">
          <button class="icon-btn" data-say="${w.word}" aria-label="Nghe mẫu ${w.word}">${raw(ICON.speaker)}</button>
          <div><b>${w.word}</b> <span class="ipa">${w.ipa}</span> <span class="tag">${PRON_LABEL[w.issue] || w.issue}</span>
          ${w.heard ? html`<div class="small muted">Bạn đọc gần như: ${w.heard}</div>` : ''}<div class="small">${w.tip}</div></div></div>`)}</div>
      </section>
      <section class="tabpane" data-p="up" hidden>
        ${(r.next_steps || []).length ? html`<div class="card"><b>3 việc nên làm ngay</b><ol>${r.next_steps.map((s) => html`<li>${s}</li>`)}</ol></div>` : ''}
        ${r.model_answer ? html`<div class="card"><div class="row"><b>Câu trả lời mẫu từ chính ý của bạn (band ${band(Math.min(9, target + 1))})</b><span class="spacer"></span>
          <button class="btn sm" id="saymodel">${raw(ICON.speaker)} Nghe</button><a class="btn sm" href="#/shadow/${a.attempt_id}">Shadowing câu này</a></div><p class="model">${r.model_answer}</p></div>` : ''}
        ${(r.upgrades || []).length ? html`<div class="card"><b>Nâng cấp từ/cụm</b><ul>${r.upgrades.map((u) => html`<li><s>${u.from}</s> → <b>${u.to}</b> <span class="small muted">— ${u.why}</span></li>`)}</ul></div>` : ''}
        ${(r.ideas || []).length ? html`<div class="card"><b>Nâng cấp ý tưởng</b><ul>${r.ideas.map((s) => html`<li>${s}</li>`)}</ul></div>` : ''}
      </section>
      ${r.target_words && r.target_words.length ? html`<section class="tabpane" data-p="tw" hidden><div class="card"><ul>${r.target_words.map((t) => html`<li><b>${t.word}</b> — ${t.used ? (t.correct ? '✅ dùng đúng' : '⚠️ dùng chưa đúng') : '⛔ chưa dùng'}<div class="small muted">${t.comment}</div></li>`)}</ul></div></section>` : ''}
      <div class="row" id="ractions"></div>
      <p class="small muted">Điểm do AI ước lượng theo band descriptors công khai, chỉ để tham khảo, không phải điểm IELTS chính thức.${a.ai_model ? '' : ''}</p>`.__html;
    el.querySelectorAll('.tab').forEach((t) => {
      t.onclick = () => {
        el.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
        el.querySelectorAll('.tabpane').forEach((p) => { p.hidden = p.dataset.p !== t.dataset.t; });
      };
    });
    el.querySelectorAll('mark.err').forEach((mk) => {
      mk.onclick = () => { const li = el.querySelector('#err' + mk.dataset.i); if (li) { li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 1200); } };
    });
    el.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => Speech.say(b.dataset.say, 0.8); });
    const sm = el.querySelector('#saymodel');
    if (sm) sm.onclick = () => Speech.say(r.model_answer);
    actions(el, a, opts);
  }

  function actions(el, a, opts) {
    const box = el.querySelector('#ractions');
    if (!box) return;
    const parts = [];
    // Một việc chính (Cải thiện câu), các việc phụ nhỏ gọn bên dưới.
    if (opts.onImprove && a.status === 'done') parts.push('<button class="btn primary act-main" data-act="improve">Nói lại bản đã sửa</button>');
    if (a.status === 'queued' || a.status === 'error') parts.push('<button class="btn primary act-main" data-act="regrade">Chấm lại ngay</button>');
    const sub = [];
    if (a.has_audio) sub.push('<button class="btn sm ghost" data-act="audio">▶ Nghe lại bài mình</button>');
    if (opts.onRetry) sub.push('<button class="btn sm ghost" data-act="retry">↻ Làm lại</button>');
    if (opts.canDelete) sub.push('<button class="btn sm ghost danger" data-act="del">Xoá</button>');
    if (sub.length) parts.push('<div class="act-sub">' + sub.join('') + '</div>');
    box.innerHTML = parts.join('');
    box.onclick = async (e) => {
      const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
      if (!act) return;
      if (act === 'audio') {
        try {
          const au = await Api.call('getAudio', { attempt_id: a.attempt_id });
          const url = b64ToUrl(au.b64, au.mime);
          let p = box.querySelector('audio');
          if (!p) { p = document.createElement('audio'); p.controls = true; p.className = 'player'; box.appendChild(p); }
          p.src = url; p.play();
        } catch (err) { toast(err.message); }
      }
      if (act === 'retry') opts.onRetry();
      if (act === 'improve') opts.onImprove(a);
      if (act === 'regrade') {
        e.target.disabled = true; e.target.textContent = 'Đang chấm…';
        try { const g = await Api.call('gradeAttempt', { attempt_id: a.attempt_id }); render(el, g, opts); } catch (err) { toast(err.message); e.target.disabled = false; }
      }
      if (act === 'del') {
        if (!confirm('Xoá bài này và file ghi âm? Không khôi phục được.')) return;
        try { await Api.call('deleteAttempt', { attempt_id: a.attempt_id }); toast('Đã xoá'); history.back(); } catch (err) { toast(err.message); }
      }
    };
  }

  window.HSResult = { render, markTranscript };
})();
