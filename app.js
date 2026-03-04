/**
 * Smart Bell Management System (SBMS)
 * app.js — with full ESP32 WiFi API integration
 */

let ESP32_IP = localStorage.getItem('esp32_ip') || '';

function esp32Url(path) {
  return `http://${ESP32_IP}${path}`;
}

async function esp32Get(path) {
  if (!ESP32_IP) return null;
  try {
    const res = await fetch(esp32Url(path), { signal: AbortSignal.timeout(3000) });
    return await res.json();
  } catch (e) {
    console.warn('ESP32 GET failed:', path, e.message);
    return null;
  }
}

async function esp32Post(path, body = {}) {
  if (!ESP32_IP) {
    showToast('ESP32 IP not set. Go to Settings first.', 'error');
    return null;
  }
  try {
    const res = await fetch(esp32Url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000)
    });
    return await res.json();
  } catch (e) {
    console.warn('ESP32 POST failed:', path, e.message);
    showToast('Could not reach ESP32. Check IP and WiFi.', 'error');
    return null;
  }
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
  card.innerHTML = `
    <h3>ESP32 Device Connection</h3>
    <p style="font-size:0.85rem;color:#666;margin-bottom:1rem;">
      Enter the IP address shown on your ESP32 OLED screen after powering on.
    </p>
    <div class="form-group">
      <label for="esp32-ip-input">ESP32 IP Address</label>
      <input type="text" id="esp32-ip-input" class="form-control" placeholder="e.g. 192.168.43.45" value="${ESP32_IP}">
    </div>
    <div style="display:flex;align-items:center;gap:1rem;margin-top:0.5rem;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:0.4rem;">
        <div id="esp32-status-dot" style="width:10px;height:10px;border-radius:50%;background:#aaa;"></div>
        <span id="esp32-status-text" style="font-size:0.85rem;color:#666;">Not checked</span>
      </div>
      <button class="btn btn-secondary" id="btn-test-esp32">Test Connection</button>
      <button class="btn btn-primary" id="btn-sync-time">Sync RTC Time Now</button>
    </div>
    <p id="esp32-time-display" style="font-size:0.8rem;color:#888;margin-top:0.7rem;"></p>
  `;
  const settingsGrid = settingsPage.querySelector('.settings-grid');
  if (settingsGrid) { settingsGrid.insertAdjacentElement('afterend', card); }
  else { settingsPage.appendChild(card); }

  document.getElementById('btn-test-esp32').addEventListener('click', async () => {
    const ip = document.getElementById('esp32-ip-input').value.trim();
    if (!ip) { showToast('Enter an IP address first', 'error'); return; }
    ESP32_IP = ip;
    localStorage.setItem('esp32_ip', ip);
    showToast('Testing connection...', 'info');
    const data = await esp32Get('/api/status');
    if (data) { showToast(`Connected! ESP32 Time: ${data.time}`, 'success'); }
    else { showToast('Could not connect. Check IP and WiFi.', 'error'); }
  });

  document.getElementById('btn-sync-time').addEventListener('click', async () => {
    const ip = document.getElementById('esp32-ip-input').value.trim();
    ESP32_IP = ip;
    localStorage.setItem('esp32_ip', ip);
    showToast('Syncing RTC time via NTP...', 'info');
    const data = await esp32Post('/api/syncTime');
    if (data && data.status === 'ok') { showToast('RTC time synced successfully!', 'success'); }
    else { showToast('Time sync failed. Check WiFi.', 'error'); }
  });
}

function startClock() {
  setInterval(() => {
    const now = new Date();
    DOM.liveTime.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    DOM.liveDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, 1000);
}

function updateDashboardData() { DOM.todayBellsCount.textContent = state.bells.length; }

async function ringBellNow() {
  const duration = state.settings.defaultDuration || 5;
  showToast(`Ringing bell for ${duration} seconds...`, 'success');
  addLogEntry('Manual');
  await esp32Post('/api/ringNow', { duration });
}

async function activateEmergency() {
  state.isEmergency = true;
  DOM.emergencyOverlay.classList.remove('hidden');
  addLogEntry('Emergency');
  await esp32Post('/api/emergency', { active: true });
}

async function deactivateEmergency() {
  state.isEmergency = false;
  DOM.emergencyOverlay.classList.add('hidden');
  await esp32Post('/api/emergency', { active: false });
  showToast('Emergency bell deactivated', 'success');
}

function populateTimeDropdowns() {
  for (let h = 0; h < 24; h++) {
    const val = h.toString().padStart(2, '0');
    let o = document.createElement('option'); o.value = val; o.textContent = val; DOM.bellHour.appendChild(o);
  }
  for (let m = 0; m < 60; m++) {
    const val = m.toString().padStart(2, '0');
    let o = document.createElement('option'); o.value = val; o.textContent = val; DOM.bellMinute.appendChild(o);
  }
}

function renderScheduleTable() {
  DOM.scheduleTbody.innerHTML = '';
  if (state.bells.length === 0) {
    DOM.scheduleEmpty.classList.remove('hidden');
    DOM.scheduleTbody.parentElement.classList.add('hidden');
    updateDashboardData(); return;
  }
  DOM.scheduleEmpty.classList.add('hidden');
  DOM.scheduleTbody.parentElement.classList.remove('hidden');
  const sortedBells = [...state.bells].sort((a, b) => (a.hour + a.minute).localeCompare(b.hour + b.minute));
  sortedBells.forEach(bell => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${bell.id.toString().substring(0, 4)}</td>
      <td><strong>${bell.hour}:${bell.minute}</strong></td>
      <td>${bell.duration} sec</td>
      <td class="text-right">
        <button class="btn btn-secondary edit-bell-btn" data-id="${bell.id}"><ion-icon name="pencil-outline"></ion-icon> Edit</button>
        <button class="btn btn-danger-outline delete-bell-btn" data-id="${bell.id}"><ion-icon name="trash-outline"></ion-icon></button>
      </td>`;
    DOM.scheduleTbody.appendChild(tr);
  });
  document.querySelectorAll('.edit-bell-btn').forEach(btn => btn.addEventListener('click', (e) => editBell(e.currentTarget.dataset.id)));
  document.querySelectorAll('.delete-bell-btn').forEach(btn => btn.addEventListener('click', (e) => confirmDeleteBell(e.currentTarget.dataset.id)));
  updateDashboardData();
}

function openAddBellModal() {
  DOM.bellIdInput.value = '';
  document.getElementById('modal-title').textContent = 'Add New Bell';
  DOM.bellHour.value = '08'; DOM.bellMinute.value = '00';
  DOM.bellDuration.value = state.settings.defaultDuration;
  DOM.bellModal.classList.remove('hidden');
}

function editBell(id) {
  const bell = state.bells.find(b => b.id == id);
  if (bell) {
    DOM.bellIdInput.value = bell.id;
    document.getElementById('modal-title').textContent = 'Edit Bell';
    DOM.bellHour.value = bell.hour; DOM.bellMinute.value = bell.minute; DOM.bellDuration.value = bell.duration;
    DOM.bellModal.classList.remove('hidden');
  }
}

function closeBellModal() { DOM.bellModal.classList.add('hidden'); }

async function saveBell() {
  const id = DOM.bellIdInput.value;
  const bellData = { hour: DOM.bellHour.value, minute: DOM.bellMinute.value, duration: parseInt(DOM.bellDuration.value) };
  if (id) {
    const index = state.bells.findIndex(b => b.id == id);
    if (index > -1) { state.bells[index] = { ...state.bells[index], ...bellData }; showToast('Bell updated', 'success'); }
  } else {
    bellData.id = generateId(); state.bells.push(bellData); showToast('Bell added', 'success');
  }
  closeBellModal(); renderScheduleTable();
  await pushScheduleToESP32();
}

let bellToDeleteId = null;

function confirmDeleteBell(id) {
  bellToDeleteId = id;
  DOM.confirmMessage.textContent = "Are you sure you want to delete this scheduled bell?";
  DOM.executeConfirmBtn.onclick = async () => {
    state.bells = state.bells.filter(b => b.id != bellToDeleteId);
    showToast('Bell deleted', 'success');
    closeConfirmModal(); renderScheduleTable();
    await pushScheduleToESP32();
  };
  DOM.confirmModal.classList.remove('hidden');
}

function closeConfirmModal() { DOM.confirmModal.classList.add('hidden'); bellToDeleteId = null; }

async function pushScheduleToESP32() {
  const payload = { bells: state.bells.map(b => ({ hour: parseInt(b.hour), minute: parseInt(b.minute), duration: b.duration })) };
  const result = await esp32Post('/api/setSchedule', payload);
  if (result && result.status === 'ok') { showToast('Schedule saved to ESP32!', 'success'); }
}

function renderLogsTable() {
  DOM.logsTbody.innerHTML = '';
  if (state.logs.length === 0) { DOM.logsEmpty.classList.remove('hidden'); DOM.logsTbody.parentElement.classList.add('hidden'); return; }
  DOM.logsEmpty.classList.add('hidden'); DOM.logsTbody.parentElement.classList.remove('hidden');
  state.logs.forEach(log => {
    const tr = document.createElement('tr');
    let typeBadge = '';
    if (log.type === 'Auto') typeBadge = `<span style="color:var(--primary-color);font-weight:600;">Auto</span>`;
    if (log.type === 'Manual') typeBadge = `<span style="color:var(--success-color);font-weight:600;">Manual Override</span>`;
    if (log.type === 'Emergency') typeBadge = `<span style="color:var(--danger-color);font-weight:600;">Emergency</span>`;
    tr.innerHTML = `<td>${log.date}</td><td>${log.time}</td><td>${typeBadge}</td>`;
    DOM.logsTbody.appendChild(tr);
  });
}

function addLogEntry(type) {
  const now = new Date();
  state.logs.unshift({ date: now.toISOString().split('T')[0], time: now.toLocaleTimeString('en-US', { hour12: false }), type });
  renderLogsTable();
}

function clearLogs() {
  if (state.logs.length === 0) return;
  DOM.confirmMessage.textContent = "Clear all system logs?";
  DOM.executeConfirmBtn.onclick = () => { state.logs = []; showToast('Logs cleared', 'success'); closeConfirmModal(); renderLogsTable(); };
  DOM.confirmModal.classList.remove('hidden');
}

function exportLogs() {
  if (state.logs.length === 0) { showToast('No logs to export', 'error'); return; }
  let csv = "data:text/csv;charset=utf-8,Date,Time,Type\n";
  state.logs.forEach(r => { csv += `${r.date},${r.time},${r.type}\n`; });
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csv)); link.setAttribute("download", "sbms_logs.csv");
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  showToast('Logs exported', 'success');
}

async function saveSettings() {
  const ipInput = document.getElementById('esp32-ip-input');
  if (ipInput) { ESP32_IP = ipInput.value.trim(); localStorage.setItem('esp32_ip', ESP32_IP); }
  const defaultDuration = parseInt(document.getElementById('default-duration').value);
  const timezone = document.getElementById('timezone-select').value;
  const buzzerEnabled = document.getElementById('toggle-buzzer').checked;
  const relayEnabled = document.getElementById('toggle-relay').checked;
  state.settings = { defaultDuration, timezone, buzzerEnabled, relayEnabled };
  await esp32Post('/api/settings', { buzzerEnabled, relayEnabled });
  showToast('Settings saved!', 'success');
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
}

document.addEventListener('DOMContentLoaded', init);
