// API_URL: máy chủ Apps Script (…/exec) — điền khi triển khai. Chạy thử trên máy (localhost) thì dùng '/api' của dev_server.
window.HS_CONFIG = {
  API_URL: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '/api' : 'https://script.google.com/macros/s/AKfycbxYKpjjtwn2sQ10R0Axv-fypESjHH9rH50KpnStrfoWD1HDQgEIYKSjYa4ifDU1fVwC2A/exec',
  APP_NAME: 'Học speaking',
};
