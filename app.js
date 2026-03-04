/**
 * Smart Bell Management System (SBMS)
 * app.js — with full ESP32 WiFi API integration
 */

let ESP32_IP = localStorage.getItem('esp32_ip') || 'smartbell.local';

function esp32Url(path) { return `http://${ESP32_IP}${path}`; }

async function esp32Get(path) {
  if (!ESP32_IP) return null;
  try {
    const res = await fetch(esp32Url(path), { signal: AbortSignal.timeout(3000) });
    return await res.json();
  } catch (e) { console.warn('ESP32 GET failed:', path, e.message); return null; }
}

async function esp32Post(path, body = {}) {
  if (!ESP32_IP) { showToast('ESP32 IP not set. Go to Settings first.', 'error'); return null; }
  try {
    const res = await fetch(esp32Url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000)
    });
    return await res.json();
  } catch (e) { console.warn('ESP32 POST failed:', path, e.message); showToast('Could not reach ESP32. Check IP and WiFi.', 'error'); return null; }
}

const state = {
  isAuthenticated: false,
  currentView: 'dashboard',
  bells: [
    { id: '1', hour: '08', minute: '30', duration: 10 },
    { id: '2', hour: '10', minute: '00', duration: 5 },
    { id: '3', hour: '12', minute: '30', duration: 10 },
    { id: '4', hour: '15', minute: '00', duration: 5 }
  ],
  logs: [
    { date: '2026-03-02', time: '08:30:00', type: 'Auto' },
    { date: '2026-03-01', time: '15:00:00', type: 'Auto' },
    { date: '2026-03-01', time: '12:30:00', type: 'Auto' }
  ],
  settings: { defaultDuration: 5, timezone: '+05:30', buzzerEnabled: true, relayEnabled: true },
  isEmergency: false,
  allowedUsers: [
    { email: 'admin@sbms.com', password: 'admin123', role: 'admin' },
    { email: 'staff@sbms.com', password: 'staff123', role: 'staff' }
  ]
};

const DOM = {
  viewLogin: document.getElementById('view-login'),
  viewApp: document.getElementById('view-app'),
  loginForm: document.getElementById('login-form'),
  sidebar: document.getElementById('sidebar'),
  navLinks: document.querySelectorAll('.nav-link[data-target]'),
  pages: document.querySelectorAll('.page'),
  menuToggle: document.getElementById('menu-toggle'),
  mobileSidebarClose: document.getElementById('mobile-sidebar-close'),
  logoutBtn: document.getElementById('logout-btn'),
  liveTime: document.getElementById('live-time'),
  liveDate: document.getElementById('live-date'),
  todayBellsCount: document.getElementById('today-bells-count'),
  btnRingNow: document.getElementById('btn-ring-now'),
  btnEmergencyTop: document.getElementById('btn-emergency-top'),
  btnEmergencyMain: document.getElementById('btn-emergency-main'),
  scheduleTbody: document.getElementById('schedule-tbody'),
  scheduleEmpty: document.getElementById('schedule-empty'),
  btnAddBell: document.getElementById('btn-add-bell'),
  bellModal: document.getElementById('bell-modal'),
  closeBellModal: document.getElementById('close-bell-modal'),
  cancelBellBtn: document.getElementById('cancel-bell-btn'),
  saveBellBtn: document.getElementById('save-bell-btn'),
  confirmModal: document.getElementById('confirm-modal'),
  closeConfirmModal: document.getElementById('close-confirm-modal'),
  cancelConfirmBtn: document.getElementById('cancel-confirm-btn'),
  executeConfirmBtn: document.getElementById('execute-confirm-btn'),
  confirmMessage: document.getElementById('confirm-message'),
  emergencyOverlay: document.getElementById('emergency-overlay'),
  cancelEmergencyBtn: document.getElementById('cancel-emergency-btn'),
  bellIdInput: document.getElementById('bell-id'),
  bellHour: document.getElementById('bell-hour'),
  bellMinute: document.getElementById('bell-minute'),
  bellDuration: document.getElementById('bell-duration'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  logsTbody: document.getElementById('logs-tbody'),
  logsEmpty: document.getElementById('logs-empty'),
  btnClearLogs: document.getElementById('btn-clear-logs'),
  btnExportLogs: document.getElementById('btn-export-logs'),
  currentYear: document.getElementById('current-year'),
  toastContainer: document.getElementById('toast-container')
};

function init() {
  populateTimeDropdowns();
  setupEventListeners();
  startClock();
  DOM.currentYear.textContent = new Date().getFullYear();
  injectESP32SettingsUI();
  if (state.isAuthenticated) { showApp(); } else { showLogin(); }
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const user = state.allowedUsers.find(u => u.email === email && u.password === password);
  if (user) { state.isAuthenticated = true; showToast('Login successful', 'success'); showApp(); }
  else { showToast('Invalid email or password.', 'error'); }
}

function handleLogout(e) {
  if (e) e.preventDefault();
  state.isAuthenticated = false;
  DOM.loginForm.reset();
  showLogin();
}

function showLogin() { DOM.viewApp.classList.remove('active'); DOM.viewLogin.classList.add('active'); }

function showApp() {
  DOM.viewLogin.classList.remove('active');
  DOM.viewApp.classList.add('active');
  updateDashboardData();
  renderScheduleTable();
  renderLogsTable();
  startESP32StatusPolling();
}

function setupEventListeners() {
  DOM.loginForm.addEventListener('submit', handleLogin);
  DOM.logoutBtn.addEventListener('click', handleLogout);
  DOM.menuToggle.addEventListener('click', () => DOM.sidebar.classList.add('open'));
  DOM.mobileSidebarClose.addEventListener('click', () => DOM.sidebar.classList.remove('open'));
  DOM.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) DOM.sidebar.classList.remove('open');
      DOM.navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const targetId = link.getAttribute('data-target');
      DOM.pages.forEach(p => p.classList.remove('active'));
      document.getElementById(`page-${targetId}`).classList.add('active');
      state.currentView = targetId;
    });
  });
  DOM.btnRingNow.addEventListener('click', ringBellNow);
  DOM.btnEmergencyTop.addEventListener('click', activateEmergency);
  DOM.btnEmergencyMain.addEventListener('click', activateEmergency);
  DOM.cancelEmergencyBtn.addEventListener('click', deactivateEmergency);
  DOM.btnAddBell.addEventListener('click', openAddBellModal);
  DOM.closeBellModal.addEventListener('click', closeBellModal);
  DOM.cancelBellBtn.addEventListener('click', closeBellModal);
  DOM.saveBellBtn.addEventListener('click', saveBell);
  DOM.closeConfirmModal.addEventListener('click', closeConfirmModal);
  DOM.cancelConfirmBtn.addEventListener('click', closeConfirmModal);
  DOM.btnClearLogs.addEventListener('click', clearLogs);
  DOM.btnExportLogs.addEventListener('click', exportLogs);
  DOM.btnSaveSettings.addEventListener('click', saveSettings);
}

let statusInterval = null;

function startESP32StatusPolling() {
  if (statusInterval) clearInterval(statusInterval);
  checkESP32Status();
  statusInterval = setInterval(checkESP32Status, 5000);
}

async function checkESP32Status() {
  if (!ESP32_IP) return;
  const data = await esp32Get('/api/status');
  const statusDot = document.getElementById('esp32-status-dot');
  const statusText = document.getElementById('esp32-status-text');
  const el = document.getElementById('esp32-time-display');
  if (data) {
    if (el) el.textContent = `ESP32 Time: ${data.time}  |  Date: ${data.date}`;
    if (statusDot) statusDot.style.background = '#22c55e';
    if (statusText) statusText.textContent = 'Connected';
  } else {
    if (statusDot) statusDot.style.background = '#ef4444';
    if (statusText) statusText.textContent = 'Disconnected';
  }
}

function injectESP32SettingsUI() {
  const settingsPage = document.getElementById('page-settings');
  if (!settingsPage) return;
  const card = document.createElement('div');
  card.className = 'settings-card shadow-card';
  card.style.marginTop = '1.5rem';
  card.
