/**
 * Smart Bell Management System
 * App Logic specifically built for Vanilla HTML/CSS
 */

// ==========================================
// STATE MANAGEMENT
// ==========================================
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
    settings: {
        defaultDuration: 5,
        timezone: '+05:30',
        buzzerEnabled: true,
        relayEnabled: true
    },
    isEmergency: false,
    allowedUsers: [
        { email: 'admin@sbms.com', password: 'admin123', role: 'admin' },
        { email: 'staff@sbms.com', password: 'staff123', role: 'staff' }
    ]
};

// ==========================================
// DOM ELEMENTS
// ==========================================
const DOM = {
    // Views
    viewLogin: document.getElementById('view-login'),
    viewApp: document.getElementById('view-app'),

    // Login
    loginForm: document.getElementById('login-form'),

    // Navigation
    sidebar: document.getElementById('sidebar'),
    navLinks: document.querySelectorAll('.nav-link[data-target]'),
    pages: document.querySelectorAll('.page'),
    menuToggle: document.getElementById('menu-toggle'),
    mobileSidebarClose: document.getElementById('mobile-sidebar-close'),
    logoutBtn: document.getElementById('logout-btn'),

    // Dashboard Components
    liveTime: document.getElementById('live-time'),
    liveDate: document.getElementById('live-date'),
    todayBellsCount: document.getElementById('today-bells-count'),
    btnRingNow: document.getElementById('btn-ring-now'),
    btnEmergencyTop: document.getElementById('btn-emergency-top'),
    btnEmergencyMain: document.getElementById('btn-emergency-main'),

    // Schedule
    scheduleTbody: document.getElementById('schedule-tbody'),
    scheduleEmpty: document.getElementById('schedule-empty'),
    btnAddBell: document.getElementById('btn-add-bell'),

    // Modals
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

    // Form Inputs
    bellIdInput: document.getElementById('bell-id'),
    bellHour: document.getElementById('bell-hour'),
    bellMinute: document.getElementById('bell-minute'),
    bellDuration: document.getElementById('bell-duration'),

    // Settings
    btnSaveSettings: document.getElementById('btn-save-settings'),

    // Logs
    logsTbody: document.getElementById('logs-tbody'),
    logsEmpty: document.getElementById('logs-empty'),
    btnClearLogs: document.getElementById('btn-clear-logs'),
    btnExportLogs: document.getElementById('btn-export-logs'),

    // Misc
    currentYear: document.getElementById('current-year'),
    toastContainer: document.getElementById('toast-container')
};

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    populateTimeDropdowns();
    setupEventListeners();
    startClock();
    DOM.currentYear.textContent = new Date().getFullYear();

    // Check initial auth state (could check localStorage)
    if (state.isAuthenticated) {
        showApp();
    } else {
        showLogin();
    }
}

// ==========================================
// AUTHENTICATION
// ==========================================
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    // Client-side validation against allowed users
    const user = state.allowedUsers.find(u => u.email === email && u.password === password);

    if (user) {
        state.isAuthenticated = true;
        showToast('Login successful', 'success');
        showApp();
    } else {
        showToast('Invalid email or password.', 'error');
    }
}

function handleLogout(e) {
    if (e) e.preventDefault();
    state.isAuthenticated = false;
    DOM.loginForm.reset();
    showLogin();
}

function showLogin() {
    DOM.viewApp.classList.remove('active');
    DOM.viewLogin.classList.add('active');
}

function showApp() {
    DOM.viewLogin.classList.remove('active');
    DOM.viewApp.classList.add('active');
    updateDashboardData();
    renderScheduleTable();
    renderLogsTable();
}

// ==========================================
// NAVIGATION
// ==========================================
function setupEventListeners() {
    // Login
    DOM.loginForm.addEventListener('submit', handleLogin);
    DOM.logoutBtn.addEventListener('click', handleLogout);

    // Sidebar Mobile Toggle
    DOM.menuToggle.addEventListener('click', () => DOM.sidebar.classList.add('open'));
    DOM.mobileSidebarClose.addEventListener('click', () => DOM.sidebar.classList.remove('open'));

    // Navigation routing
    DOM.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Close sidebar on mobile after click
            if (window.innerWidth <= 768) {
                DOM.sidebar.classList.remove('open');
            }

            // Update active link class
            DOM.navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show target page
            const targetId = link.getAttribute('data-target');
            DOM.pages.forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${targetId}`).classList.add('active');

            state.currentView = targetId;
        });
    });

    // Quick Actions
    DOM.btnRingNow.addEventListener('click', ringBellNow);
    DOM.btnEmergencyTop.addEventListener('click', activateEmergency);
    DOM.btnEmergencyMain.addEventListener('click', activateEmergency);
    DOM.cancelEmergencyBtn.addEventListener('click', deactivateEmergency);

    // Modals
    DOM.btnAddBell.addEventListener('click', openAddBellModal);
    DOM.closeBellModal.addEventListener('click', closeBellModal);
    DOM.cancelBellBtn.addEventListener('click', closeBellModal);
    DOM.saveBellBtn.addEventListener('click', saveBell);

    DOM.closeConfirmModal.addEventListener('click', closeConfirmModal);
    DOM.cancelConfirmBtn.addEventListener('click', closeConfirmModal);

    // Logs
    DOM.btnClearLogs.addEventListener('click', clearLogs);
    DOM.btnExportLogs.addEventListener('click', exportLogs);

    // Settings
    DOM.btnSaveSettings.addEventListener('click', saveSettings);
}

// ==========================================
// UTILITIES (Clock, Toast)
// ==========================================
function startClock() {
    setInterval(() => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour12: false });
        const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        DOM.liveTime.textContent = timeString;
        DOM.liveDate.textContent = dateString;
    }, 1000);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline';
    toast.innerHTML = `<ion-icon name="${icon}"></ion-icon> <span>${message}</span>`;

    DOM.toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// ==========================================
// DASHBOARD
// ==========================================
function updateDashboardData() {
    DOM.todayBellsCount.textContent = state.bells.length;
}

// API Simulation
function ringBellNow() {
    // Simulated API POST to ESP32: POST /api/ringNow

    // Add to local logs
    addLogEntry('Manual');
    showToast('Bell trigged successfully!', 'success');
}

function activateEmergency() {
    state.isEmergency = true;
    DOM.emergencyOverlay.classList.remove('hidden');
    addLogEntry('Emergency');

    // Simulated API call here: POST /api/emergencyMode {"status": true}
}

function deactivateEmergency() {
    state.isEmergency = false;
    DOM.emergencyOverlay.classList.add('hidden');

    // Simulated API call here: POST /api/emergencyMode {"status": false}
    showToast('Emergency mode deactivated', 'success');
}

// ==========================================
// SCHEDULE MANAGEMENT
// ==========================================
function populateTimeDropdowns() {
    // Hours
    for (let i = 0; i < 24; i++) {
        let val = i.toString().padStart(2, '0');
        let option = document.createElement('option');
        option.value = val; option.textContent = val;
        DOM.bellHour.appendChild(option);
    }
    // Minutes
    for (let i = 0; i < 60; i++) {
        let val = i.toString().padStart(2, '0');
        let option = document.createElement('option');
        option.value = val; option.textContent = val;
        DOM.bellMinute.appendChild(option);
    }
}

function renderScheduleTable() {
    DOM.scheduleTbody.innerHTML = '';

    if (state.bells.length === 0) {
        DOM.scheduleEmpty.classList.remove('hidden');
        DOM.scheduleTbody.parentElement.classList.add('hidden');
        updateDashboardData();
        return;
    }

    DOM.scheduleEmpty.classList.add('hidden');
    DOM.scheduleTbody.parentElement.classList.remove('hidden');

    // Sort bells by time
    const sortedBells = [...state.bells].sort((a, b) => {
        return (a.hour + a.minute).localeCompare(b.hour + b.minute);
    });

    sortedBells.forEach(bell => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${bell.id.substring(0, 4)}</td>
            <td><strong>${bell.hour}:${bell.minute}</strong></td>
            <td>${bell.duration} sec</td>
            <td class="text-right">
                <button class="btn btn-secondary edit-bell-btn" data-id="${bell.id}">
                    <ion-icon name="pencil-outline"></ion-icon> Edit
                </button>
                <button class="btn btn-danger-outline delete-bell-btn" data-id="${bell.id}">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </td>
        `;
        DOM.scheduleTbody.appendChild(tr);
    });

    // Attach event listeners to new buttons
    document.querySelectorAll('.edit-bell-btn').forEach(btn => {
        btn.addEventListener('click', (e) => editBell(e.currentTarget.dataset.id));
    });

    document.querySelectorAll('.delete-bell-btn').forEach(btn => {
        btn.addEventListener('click', (e) => confirmDeleteBell(e.currentTarget.dataset.id));
    });

    updateDashboardData(); // Update dashboard count
}

function openAddBellModal() {
    DOM.bellIdInput.value = '';
    document.getElementById('modal-title').textContent = 'Add New Bell';
    DOM.bellHour.value = '08';
    DOM.bellMinute.value = '00';
    DOM.bellDuration.value = state.settings.defaultDuration;

    DOM.bellModal.classList.remove('hidden');
}

function editBell(id) {
    const bell = state.bells.find(b => b.id === id);
    if (bell) {
        DOM.bellIdInput.value = bell.id;
        document.getElementById('modal-title').textContent = 'Edit Bell';
        DOM.bellHour.value = bell.hour;
        DOM.bellMinute.value = bell.minute;
        DOM.bellDuration.value = bell.duration;

        DOM.bellModal.classList.remove('hidden');
    }
}

function closeBellModal() {
    DOM.bellModal.classList.add('hidden');
}

function saveBell() {
    const id = DOM.bellIdInput.value;
    const bellData = {
        hour: DOM.bellHour.value,
        minute: DOM.bellMinute.value,
        duration: parseInt(DOM.bellDuration.value)
    };

    if (id) {
        // Edit existing
        const index = state.bells.findIndex(b => b.id === id);
        if (index > -1) {
            state.bells[index] = { ...state.bells[index], ...bellData };
            showToast('Bell schedule updated', 'success');
            // ESP32 API placeholder: POST /api/updateBell {id, hour, minute, duration}
        }
    } else {
        // Add new
        bellData.id = generateId();
        state.bells.push(bellData);
        showToast('New bell scheduled successfully', 'success');
        // ESP32 API placeholder: POST /api/addBell {hour, minute, duration}
    }

    closeBellModal();
    renderScheduleTable();
}

let bellToDeleteId = null;

function confirmDeleteBell(id) {
    bellToDeleteId = id;
    DOM.confirmMessage.textContent = "Are you sure you want to delete this scheduled bell? This action cannot be undone.";

    // Override execute logic for deleting bell
    DOM.executeConfirmBtn.onclick = () => {
        state.bells = state.bells.filter(b => b.id !== bellToDeleteId);
        showToast('Bell schedule deleted', 'success');
        // ESP32 API placeholder: POST /api/deleteBell {id}

        closeConfirmModal();
        renderScheduleTable();
    };

    DOM.confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    DOM.confirmModal.classList.add('hidden');
    bellToDeleteId = null;
}

// ==========================================
// LOGS
// ==========================================
function renderLogsTable() {
    DOM.logsTbody.innerHTML = '';

    if (state.logs.length === 0) {
        DOM.logsEmpty.classList.remove('hidden');
        DOM.logsTbody.parentElement.classList.add('hidden');
        return;
    }

    DOM.logsEmpty.classList.add('hidden');
    DOM.logsTbody.parentElement.classList.remove('hidden');

    state.logs.forEach(log => {
        const tr = document.createElement('tr');

        let typeBadge = '';
        if (log.type === 'Auto') typeBadge = `<span style="color:var(--primary-color);font-weight:600;">Auto</span>`;
        if (log.type === 'Manual') typeBadge = `<span style="color:var(--success-color);font-weight:600;">Manual Override</span>`;
        if (log.type === 'Emergency') typeBadge = `<span style="color:var(--danger-color);font-weight:600;">Emergency</span>`;

        tr.innerHTML = `
            <td>${log.date}</td>
            <td>${log.time}</td>
            <td>${typeBadge}</td>
        `;
        DOM.logsTbody.appendChild(tr);
    });
}

function addLogEntry(type) {
    const now = new Date();
    // format YYYY-MM-DD
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    state.logs.unshift({ date: dateStr, time: timeStr, type: type });
    renderLogsTable();
}

function clearLogs() {
    if (state.logs.length === 0) return;

    DOM.confirmMessage.textContent = "Are you sure you want to clear all system logs?";
    DOM.executeConfirmBtn.onclick = () => {
        state.logs = [];
        showToast('Logs cleared successfully', 'success');
        closeConfirmModal();
        renderLogsTable();
        // ESP32 API placeholder: POST /api/clearLogs
    };
    DOM.confirmModal.classList.remove('hidden');
}

function exportLogs() {
    if (state.logs.length === 0) {
        showToast('No logs to export', 'error');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Time,Type\n";

    state.logs.forEach(row => {
        csvContent += `${row.date},${row.time},${row.type}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sbms_logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Logs exported successfully', 'success');
}

// ==========================================
// SETTINGS
// ==========================================
function saveSettings() {
    const defaultDuration = parseInt(document.getElementById('default-duration').value);
    const timezone = document.getElementById('timezone-select').value;
    const buzzerEnabled = document.getElementById('toggle-buzzer').checked;
    const relayEnabled = document.getElementById('toggle-relay').checked;

    state.settings = { defaultDuration, timezone, buzzerEnabled, relayEnabled };

    // ESP32 API placeholder: POST /api/updateSettings { ...settings }

    showToast('Configuration saved to device', 'success');
}

// Boot up
document.addEventListener('DOMContentLoaded', init);
