// Thư viện dùng chung: gọi API, lưu trên máy, giọng đọc, nhận giọng nói, ghi âm WAV, tiện ích DOM.
(function () {
  const CFG = window.HS_CONFIG || { API_URL: '/api' };
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bộ nhớ đầy hoặc bị chặn */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } },
  };

  // ---------- API ----------
  const Api = {
    session: LS.get('hs.session', null),
    async call(action, payload) {
      let res;
      try {
        res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload: payload || {}, session: Api.session }) });
      } catch (e) {
        throw Object.assign(new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'), { code: 'network' });
      }
      const data = await res.json().catch(() => ({ ok: false, error: { code: 'server', message: 'Máy chủ trả về dữ liệu lỗi' } }));
      if (!data.ok) {
        if (data.error && data.error.code === 'auth' && Api.session) { Api.logout(); location.hash = '#/'; }
        throw Object.assign(new Error(data.error.message), { code: data.error.code });
      }
      return data.data;
    },
    setSession(s) { Api.session = s; LS.set('hs.session', s); },
    logout() { Api.session = null; ['hs.session', 'hs.user', 'hs.config', 'hs.qcache', 'hs.notes'].forEach(LS.del); },
  };

  // ---------- Giọng giám khảo (giọng có sẵn của trình duyệt: Chrome = Google, Safari = Apple) ----------
  const Speech = {
    voices: [],
    prefs: { voice: '', rate: 0.95 },
    init() {
      if (!('speechSynthesis' in window)) return;
      const load = () => { Speech.voices = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang)); };
      load();
      speechSynthesis.onvoiceschanged = load;
    },
    pick() {
      const want = Speech.prefs.voice;
      return Speech.voices.find((v) => v.voiceURI === want || v.name === want) || Speech.voices.find((v) => /en[-_]GB/i.test(v.lang)) || Speech.voices[0] || null;
    },
    // Đọc xong mới resolve (để chuyển pha tự động).
    say(text, rate) {
      return new Promise((resolve) => {
        if (!('speechSynthesis' in window) || !text) return resolve(false);
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = Speech.pick();
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
        u.rate = rate || Number(Speech.prefs.rate) || 0.95;
        let done = false;
        const fin = () => { if (!done) { done = true; resolve(true); } };
        u.onend = fin; u.onerror = fin;
        setTimeout(fin, 4000 + text.length * 120); // một số trình duyệt không bắn onend
        speechSynthesis.speak(u);
      });
    },
    stop() { if ('speechSynthesis' in window) speechSynthesis.cancel(); },
    canListen() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
    // Phụ đề tức thời (chỉ để hiển thị; điểm chấm dùng bản Gemini nghe lại).
    listen(onText) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return null;
      const r = new SR();
      r.lang = 'en-GB'; r.interimResults = true; r.continuous = true;
      let finalText = '', stopped = false;
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '; else interim += e.results[i][0].transcript;
        }
        onText((finalText + interim).trim());
      };
      r.onend = () => { if (!stopped) { try { r.start(); } catch (e) { /* đã dừng */ } } }; // Chrome tự ngắt sau vài giây im lặng
      r.onerror = () => {};
      try { r.start(); } catch (e) { return null; }
      return { stop: () => { stopped = true; try { r.stop(); } catch (e) { /* bỏ qua */ } }, text: () => finalText.trim() };
    },
  };
  Speech.init();

  // ---------- Ghi âm → WAV 16 kHz mono (định dạng Gemini nhận chắc chắn) ----------
  const Recorder = {
    supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
    async start(onLevel) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const mime = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      let raf = 0;
      const tick = () => { an.getByteTimeDomainData(buf); let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128)); if (onLevel) onLevel(peak / 128); raf = requestAnimationFrame(tick); };
      tick();
      const started = Date.now();
      rec.start(250);
      return {
        seconds: () => (Date.now() - started) / 1000,
        stop: () => new Promise((resolve) => {
          rec.onstop = async () => {
            cancelAnimationFrame(raf);
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
            try { await ac.close(); } catch (e) { /* bỏ qua */ }
            resolve({ blob, seconds: (Date.now() - started) / 1000 });
          };
          rec.stop();
        }),
        cancel: () => { try { rec.stop(); } catch (e) { /* bỏ qua */ } cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); try { ac.close(); } catch (e) { /* bỏ qua */ } },
      };
    },
    // Giải mã bản ghi của trình duyệt rồi lấy mẫu lại 16 kHz mono → WAV 16-bit → base64.
    async toWav16k(blob) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const arr = await blob.arrayBuffer();
      const decoded = await new Promise((res, rej) => { const p = ac.decodeAudioData(arr, res, rej); if (p && p.then) p.then(res, rej); });
      try { await ac.close(); } catch (e) { /* bỏ qua */ }
      const rate = 16000;
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const off = new OAC(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
      const s = off.createBufferSource(); s.buffer = decoded; s.connect(off.destination); s.start();
      const out = await off.startRendering();
      const pcm = out.getChannelData(0);
      const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
      const w = (o, str) => { for (let i = 0; i < str.length; i++) view.setUint8(o + i, str.charCodeAt(i)); };
      w(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
      view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); w(36, 'data'); view.setUint32(40, pcm.length * 2, true);
      for (let i = 0; i < pcm.length; i++) { const v = Math.max(-1, Math.min(1, pcm[i])); view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
      const wav = new Blob([view], { type: 'audio/wav' });
      return { wav, b64: await blobToB64(wav), seconds: decoded.duration };
    },
  };
  function blobToB64(blob) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(blob); });
  }
  function b64ToUrl(b64, mime) {
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u8], { type: mime || 'audio/wav' }));
  }

  // ---------- Tiện ích DOM ----------
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // Mẫu HTML an toàn: giá trị chèn vào được mã hoá, trừ kết quả html`` lồng nhau hoặc raw().
  function html(strings, ...vals) {
    const s = strings.reduce((out, str, i) => out + str + (i < vals.length ? fmt(vals[i]) : ''), '');
    return raw(s);
  }
  function fmt(v) { if (Array.isArray(v)) return v.map(fmt).join(''); return v && v.__html !== undefined ? v.__html : esc(v); }
  function raw(s) { const o = new String(s); o.__html = String(s); return o; }
  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2800);
  }
  function band(b) { return b === null || b === undefined || b === '' || isNaN(b) ? '–' : Number(b).toFixed(1); }
  // Màu huy hiệu band: dưới mục tiêu – gần mục tiêu – đạt.
  function bandClass(b, target) { if (b === null || b === undefined || isNaN(b)) return 'b-none'; b = Number(b); target = Number(target) || 6.5; return b >= target ? 'b-ok' : b >= target - 0.5 ? 'b-near' : 'b-low'; }
  function fmtTime(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const ICON = {
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h8"/></svg>',
    teach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18v12H3z"/><path d="M8 20h8M12 16v4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    dice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="8.5" cy="15.5" r="1"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };
  const CRIT = { FC: 'Trôi chảy & mạch lạc', LR: 'Từ vựng', GRA: 'Ngữ pháp', P: 'Phát âm' };
  const CRIT_EN = { FC: 'Fluency & Coherence', LR: 'Lexical Resource', GRA: 'Grammatical Range & Accuracy', P: 'Pronunciation' };

  window.HS = { CFG, LS, Api, Speech, Recorder, blobToB64, b64ToUrl, esc, html, raw, toast, band, bandClass, fmtTime, fmtDate, shuffle, ICON, CRIT, CRIT_EN };
})();
