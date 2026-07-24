/**
 * MoneyM Helper Utilities, PWA Engine & Offline Sync Queue
 */

// Theme Manager (Default: Dark, Uses Zinc Palette)
function getTheme() {
  return localStorage.getItem('MONEYM_THEME') || 'dark';
}

function initTheme() {
  const currentTheme = getTheme();
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcon(currentTheme);
}

function toggleTheme() {
  const current = getTheme();
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('MONEYM_THEME', nextTheme);

  if (nextTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  updateThemeIcon(nextTheme);
  showToast(`Mode tampilan diubah ke ${nextTheme.toUpperCase()}`, 'info');

  if (typeof initTradingViewWidget === 'function') {
    const activePair = document.getElementById('input-pair')?.value || 'OANDA:XAUUSD';
    initTradingViewWidget(activePair);
  }
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? '<iconify-icon icon="lucide:moon" class="text-lg text-indigo-300 align-middle"></iconify-icon>'
    : '<iconify-icon icon="lucide:sun" class="text-lg text-amber-500 align-middle"></iconify-icon>';
  btn.title = theme === 'dark' ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode';
}

// Toggle Visibility Field Password (Show / Hide dengan ikon Mata)
function togglePasswordVisibility(inputId, eyeIconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(eyeIconId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('icon', 'lucide:eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('icon', 'lucide:eye');
  }
}

// Privacy Mode Manager (Sembunyikan Saldo: Rp •••••••)
function isPrivacyMode() {
  return localStorage.getItem('MONEYM_PRIVACY_MODE') === 'true';
}

function togglePrivacyMode() {
  const current = isPrivacyMode();
  const nextState = !current;
  localStorage.setItem('MONEYM_PRIVACY_MODE', nextState ? 'true' : 'false');

  updatePrivacyIcon(nextState);
  showToast(nextState ? 'Privacy Mode AKTIF (Saldo disembunyikan)' : 'Privacy Mode NONAKTIF', 'info');

  // Trigger reload data jika fungsi reload tersedia
  if (typeof loadDashboardData === 'function') loadDashboardData();
  if (typeof loadTradingData === 'function') loadTradingData();
  if (typeof loadFinanceData === 'function') loadFinanceData();
}

function updatePrivacyIcon(active) {
  const btn = document.getElementById('btn-privacy-toggle');
  if (!btn) return;
  btn.innerHTML = active
    ? '<iconify-icon icon="lucide:eye-off" class="text-lg text-amber-400 align-middle"></iconify-icon>'
    : '<iconify-icon icon="lucide:eye" class="text-lg text-zinc-400 align-middle"></iconify-icon>';
  btn.title = active ? 'Tampilkan Nominal Saldo' : 'Sembunyikan Nominal Saldo';
}

function formatPrivacyIDR(amount) {
  if (isPrivacyMode()) {
    return 'Rp •••••••';
  }
  return formatIDR(amount);
}

// Inisialisasi Tema & Privacy saat DOM Siap
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updatePrivacyIcon(isPrivacyMode());
  initOfflineSyncEngine();
  initPwaInstallBanner();
});

// Format Currency (IDR)
function formatIDR(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num);
}

// Sanitasi XSS untuk Tampilan Frontend
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Format Date (YYYY-MM-DD to DD/MM/YYYY)
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Toast Notifications (Iconify Icons)
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconHtml = '<iconify-icon icon="lucide:info" class="text-indigo-500 text-lg align-middle"></iconify-icon>';
  if (type === 'success') iconHtml = '<iconify-icon icon="lucide:check-circle-2" class="text-emerald-500 text-lg align-middle"></iconify-icon>';
  if (type === 'error') iconHtml = '<iconify-icon icon="lucide:alert-circle" class="text-rose-500 text-lg align-middle"></iconify-icon>';
  if (type === 'warning') iconHtml = '<iconify-icon icon="lucide:alert-triangle" class="text-amber-500 text-lg align-middle"></iconify-icon>';

  toast.innerHTML = `<span class="flex items-center">${iconHtml}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Global Loading Skeleton Animate Overlay Toggle
function showLoading(show = true) {
  let spinner = document.getElementById('global-loading');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.id = 'global-loading';
    spinner.className = 'fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-[9999] flex items-center justify-center hidden';
    spinner.innerHTML = `
      <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-2xl flex items-center gap-3 animate-pulse">
        <div class="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-500 flex items-center justify-center font-bold">
          <iconify-icon icon="lucide:loader-2" class="animate-spin text-xl"></iconify-icon>
        </div>
        <div class="space-y-1">
          <div class="h-3.5 bg-zinc-300 dark:bg-zinc-700/80 rounded w-28"></div>
          <div class="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded w-20"></div>
        </div>
      </div>
    `;
    document.body.appendChild(spinner);
  }
  if (show) {
    spinner.classList.remove('hidden');
  } else {
    spinner.classList.add('hidden');
  }
}

function generateUUID() {
  return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

// Native Notification Helper (Mendukung iOS 16.4+ PWA & Android)
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Browser Anda belum mendukung fitur Notifikasi Web.', 'warning');
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('Notifikasi pengingat trade aktif di perangkat Anda! 🔔', 'success');
      return true;
    }
  }
  showToast('Izin notifikasi tidak diberikan.', 'info');
  return false;
}

function sendLocalNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const defaultOptions = {
    icon: 'https://api.iconify.design/lucide:candlestick-chart.svg?color=%234f46e5',
    badge: 'https://api.iconify.design/lucide:wallet.svg?color=%234f46e5',
    vibrate: [200, 100, 200],
    tag: 'moneym-running-trade-reminder',
    renotify: true,
    ...options
  };

  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, defaultOptions);
    });
  } else {
    try {
      new Notification(title, defaultOptions);
    } catch (e) {
      console.warn('[Notification Error]', e);
    }
  }
}

// 📶 Offline Queue Manager Engine
const OFFLINE_QUEUE_KEY = 'MONEYM_OFFLINE_QUEUE';

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveOfflineQueue(action, payload) {
  const queue = getOfflineQueue();
  queue.push({
    id: generateUUID(),
    action: action,
    payload: payload,
    timestamp: Date.now()
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  showToast('⚠️ Anda sedang offline. Data disimpan di HP & akan otomatis tersinkron saat internet tersambung!', 'warning');
}

async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  showToast(`🔄 Terhubung kembali. Menyingkronkan ${queue.length} transaksi offline ke server...`, 'info');

  let successCount = 0;
  const remaining = [];

  for (let item of queue) {
    try {
      const res = await apiCall(item.action, item.payload);
      if (res && res.success) {
        successCount++;
      } else {
        remaining.push(item);
      }
    } catch (e) {
      remaining.push(item);
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));

  if (successCount > 0) {
    showToast(`✅ Berhasil menyingkronkan ${successCount} data offline!`, 'success');
    if (typeof loadDashboardData === 'function') loadDashboardData();
    if (typeof loadTradingData === 'function') loadTradingData();
    if (typeof loadFinanceData === 'function') loadFinanceData();
  }
}

function initOfflineSyncEngine() {
  window.addEventListener('online', () => {
    syncOfflineQueue();
  });
  window.addEventListener('offline', () => {
    showToast('📶 Sinyal terputus. Mode pencatatan offline aktif.', 'warning');
  });

  // Percobaan sync otomatis saat pertama kali dibuka jika online
  if (navigator.onLine) {
    setTimeout(syncOfflineQueue, 2000);
  }
}

// 📲 Custom PWA Install Prompt Engine
window.deferredPwaPrompt = null;

function initPwaInstallBanner() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPwaPrompt = e;

    const installed = localStorage.getItem('MONEYM_PWA_INSTALLED') === 'true';
    if (!installed) {
      showPwaInstallBannerUI();
    }
  });

  window.addEventListener('appinstalled', () => {
    window.deferredPwaPrompt = null;
    localStorage.setItem('MONEYM_PWA_INSTALLED', 'true');
    hidePwaInstallBannerUI();
    showToast('🎉 Aplikasi MoneyM berhasil diinstall di HP Anda!', 'success');
  });
}

let pwaInstallTimer = null;

function showPwaInstallBannerUI() {
  let banner = document.getElementById('pwa-install-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 bg-zinc-900/95 backdrop-blur-xl border border-indigo-500/50 rounded-2xl shadow-2xl z-50 text-white overflow-hidden transition-all duration-500 transform translate-y-12 opacity-0 pointer-events-auto';
    banner.innerHTML = `
      <div class="p-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-md text-white shrink-0">
            <iconify-icon icon="lucide:smartphone-charging" class="text-xl"></iconify-icon>
          </div>
          <div>
            <h4 class="text-xs font-extrabold text-white flex items-center gap-1.5">
              <span>Install MoneyM App</span>
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </h4>
            <p class="text-[11px] text-zinc-400">Akses cepat & fleksibel dari layar HP</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="triggerPwaInstall()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95">
            Install
          </button>
          <button onclick="hidePwaInstallBannerUI()" class="p-1.5 text-zinc-400 hover:text-white rounded-lg transition">
            <iconify-icon icon="lucide:x" class="text-base"></iconify-icon>
          </button>
        </div>
      </div>
      <div class="h-1 bg-zinc-800 w-full overflow-hidden">
        <div id="pwa-timer-bar" class="h-full bg-indigo-500 animate-timer-30s"></div>
      </div>
    `;
    document.body.appendChild(banner);
  }

  if (pwaInstallTimer) clearTimeout(pwaInstallTimer);

  banner.classList.remove('hidden');

  // Trigger smooth enter animation
  setTimeout(() => {
    banner.classList.remove('translate-y-12', 'opacity-0');
    banner.classList.add('translate-y-0', 'opacity-100');
  }, 50);

  // Reset & trigger 30s countdown bar animation
  const timerBar = document.getElementById('pwa-timer-bar');
  if (timerBar) {
    timerBar.classList.remove('animate-timer-30s');
    void timerBar.offsetWidth; // Force DOM reflow
    timerBar.classList.add('animate-timer-30s');
  }

  // Auto-hide after 30 seconds
  pwaInstallTimer = setTimeout(() => {
    hidePwaInstallBannerUI();
  }, 30000);
}

function hidePwaInstallBannerUI() {
  if (pwaInstallTimer) {
    clearTimeout(pwaInstallTimer);
    pwaInstallTimer = null;
  }
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    // Smooth exit animation
    banner.classList.remove('translate-y-0', 'opacity-100');
    banner.classList.add('translate-y-12', 'opacity-0');
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 500);
  }
}

async function triggerPwaInstall() {
  if (window.deferredPwaPrompt) {
    window.deferredPwaPrompt.prompt();
    const { outcome } = await window.deferredPwaPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('MONEYM_PWA_INSTALLED', 'true');
    }
    window.deferredPwaPrompt = null;
    hidePwaInstallBannerUI();
  } else {
    showToast('Gunakan opsi "Tambahkan ke Layar Utama" pada menu browser HP Anda.', 'info');
  }
}

/**
 * Dynamic Permission Guard & Menu Visibility Controller
 */
function applyPermissionGuards(pageName) {
  const session = getSession();
  if (!session) return;

  const isSA = session.role === 'Super Admin' || session.role === 'admin' || (session.username && session.username.toLowerCase() === 'admin');
  const perms = session.permissions || {
    Dashboard: true,
    Trading: true,
    Finance: true,
    CRUDTrading: true,
    CRUDFinance: true
  };

  // 1. Sembunyikan Tombol Navigasi Desktop & Mobile yang tidak diberi izin
  const navDash = document.getElementById('nav-dash-link');
  const navTrade = document.getElementById('nav-trade-link');
  const navFin = document.getElementById('nav-fin-link');
  const navAdmin = document.getElementById('nav-admin-link');

  const mobileDash = document.getElementById('mobile-dash-link');
  const mobileTrade = document.getElementById('mobile-trade-link');
  const mobileFin = document.getElementById('mobile-fin-link');
  const mobileAdmin = document.getElementById('mobile-admin-link');

  if (!isSA && perms.Dashboard === false) {
    if (navDash) navDash.classList.add('hidden');
    if (mobileDash) mobileDash.classList.add('hidden');
  }
  if (!isSA && perms.Trading === false) {
    if (navTrade) navTrade.classList.add('hidden');
    if (mobileTrade) mobileTrade.classList.add('hidden');
  }
  if (!isSA && perms.Finance === false) {
    if (navFin) navFin.classList.add('hidden');
    if (mobileFin) mobileFin.classList.add('hidden');
  }
  if (!isSA) {
    if (navAdmin) navAdmin.classList.add('hidden');
    if (mobileAdmin) mobileAdmin.classList.add('hidden');
  } else {
    if (navAdmin) navAdmin.classList.remove('hidden');
    if (mobileAdmin) mobileAdmin.classList.remove('hidden');
  }

  // 2. Proteksi Halaman Saat Ini (Block & Hide Tampilan jika tidak punya izin)
  if (!isSA) {
    if (pageName === 'Dashboard' && perms.Dashboard === false) {
      blockAccessAndRedirect('Akses ditolak: Anda tidak memiliki izin mengakses Dashboard.');
      return;
    } else if (pageName === 'Trading' && perms.Trading === false) {
      blockAccessAndRedirect('Akses ditolak: Anda tidak memiliki izin mengakses modul Trading.');
      return;
    } else if (pageName === 'Finance' && perms.Finance === false) {
      blockAccessAndRedirect('Akses ditolak: Anda tidak memiliki izin mengakses modul Keuangan.');
      return;
    }
  }

  // 3. Sembunyikan Tombol CRUD Tambah Data jika tidak ada izin CRUD
  if (!isSA) {
    if (pageName === 'Trading' && perms.CRUDTrading === false) {
      const btnAdd = document.getElementById('btn-add-trading');
      if (btnAdd) btnAdd.classList.add('hidden');
    }
    if (pageName === 'Finance' && perms.CRUDFinance === false) {
      const btnAdd = document.getElementById('btn-add-finance');
      if (btnAdd) btnAdd.classList.add('hidden');
    }
  }
}

function blockAccessAndRedirect(msg) {
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <div class="max-w-md mx-auto my-12 p-8 bg-white dark:bg-zinc-900 border border-rose-500/30 rounded-3xl text-center space-y-4 shadow-2xl">
        <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl mx-auto flex items-center justify-center font-bold text-3xl">
          <iconify-icon icon="lucide:shield-alert"></iconify-icon>
        </div>
        <h3 class="text-lg font-bold text-zinc-900 dark:text-zinc-100">Akses Ditolak</h3>
        <p class="text-xs text-zinc-400">${msg}</p>
        <button onclick="redirectFirstAvailablePage()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition">
          Ke Halaman Yang Diizinkan
        </button>
      </div>
    `;
  }
  showToast(msg, 'error');
}

function redirectFirstAvailablePage() {
  const session = getSession();
  if (!session) {
    window.location.href = './login.html';
    return;
  }
  const isSA = session.role === 'Super Admin' || session.role === 'admin';
  const p = session.permissions || {};

  if (isSA || p.Dashboard !== false) {
    window.location.href = './dashboard.html';
  } else if (p.Trading !== false) {
    window.location.href = './trading.html';
  } else if (p.Finance !== false) {
    window.location.href = './finance.html';
  } else {
    showToast('Akun Anda tidak memiliki izin ke halaman manapun. Hubungi Super Admin.', 'error');
    setTimeout(() => {
      logout();
    }, 2000);
  }
}

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
  });
}
