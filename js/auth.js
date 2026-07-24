/**
 * AFinTrack - Authentication & API Dispatcher (High-Grade Security)
 */

// Ubah URL ini menjadi URL Deployment Google Apps Script (Web App) Anda
const AFINTRACK_API_URL = "https://script.google.com/macros/s/AKfycbzVOmPHhy0R03-TATh1WTJ4KuV39n30CQIpPv6OqPSJQ5NTv6MQD50Ila-ax5TJYRvx/exec";

// Multi-User Session Storage Keys
const SESSION_KEY = "AFINTRACK_ACTIVE_SESSION";

function getSession() {
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    // Check local 24-hour expiration
    if (parsed.timestamp && (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000)) {
      clearSession();
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveSession(sessionData) {
  sessionData.timestamp = Date.now();
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

function destroyAllUserSessions() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('MONEYM_CACHE_SESSION'); // backward compat
  localStorage.removeItem('AFINTRACK_CACHE_SESSION');
  localStorage.removeItem(PIN_KEY);
  sessionStorage.clear();

  // Hapus seluruh cookie browser secara total
  document.cookie.split(";").forEach(c => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
}

function clearSession() {
  destroyAllUserSessions();
}

function logout() {
  destroyAllUserSessions();
  window.location.href = './login.html';
}

async function checkAuthGuard() {
  const session = getSession();
  const currentPath = (window.location.pathname || '').toLowerCase();
  const isLoginPage = currentPath.endsWith('login.html') || currentPath.includes('login.html');

  if (!session && !isLoginPage) {
    destroyAllUserSessions();
    window.location.href = './login.html';
    return;
  } else if (session && isLoginPage) {
    window.location.href = './dashboard.html';
    return;
  }

  // Verifikasi Realtime ke Server saat membuka halaman terproteksi
  if (session && !isLoginPage) {
    const res = await apiCall('verifySession');
    if (res && res.code === 401) {
      destroyAllUserSessions();
      showToast('Akses ditolak: Akun Anda telah dihapus atau dinonaktifkan.', 'error');
      setTimeout(() => {
        window.location.href = './login.html';
      }, 400);
    }
  }
}

const PIN_KEY = "AFINTRACK_PIN_CODE";

function getPin() {
  return localStorage.getItem(PIN_KEY) || "";
}

function savePin(pin) {
  if (pin && String(pin).length === 4) {
    localStorage.setItem(PIN_KEY, String(pin));
    return true;
  }
  return false;
}

function clearPin() {
  localStorage.removeItem(PIN_KEY);
}

/**
 * Client API Call Dispatcher
 */
async function apiCall(action, payload = {}) {
  const session = getSession();
  const token = session ? session.token : "";

  // Jika sedang offline & aksi adalah mutasi (add/update/delete), simpan ke Offline Queue
  if (!navigator.onLine && (action.startsWith('add') || action.startsWith('update') || action.startsWith('delete'))) {
    if (typeof saveOfflineQueue === 'function') {
      saveOfflineQueue(action, payload);
      return { success: true, message: 'Data disimpan secara offline di HP Anda.' };
    }
  }

  const bodyData = {
    action: action,
    token: token,
    ...payload
  };

  const apiUrl = localStorage.getItem('AFINTRACK_API_URL') || localStorage.getItem('MONEYM_API_URL') || AFINTRACK_API_URL || "";

  // Jika URL API belum dikonfigurasi, beri peringatan agar pengguna mengisinya
  if (!apiUrl || apiUrl.trim() === "") {
    showToast('URL Apps Script belum diisi! Silakan atur URL API di Halaman Login.', 'warning');
    return {
      success: false,
      message: 'URL Apps Script Backend belum dikonfigurasi. Silakan atur Web App URL di Halaman Login.'
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(bodyData)
    });

    const result = await response.json();
    if (result && result.code === 401) {
      showToast('Akses ditolak: Akun Anda telah dinonaktifkan atau dihapus.', 'warning');
      clearSession();
      setTimeout(() => window.location.href = './login.html', 1500);
    }
    return result;
  } catch (error) {
    console.error('[AFinTrack API Error]', error);
    if (action.startsWith('add') || action.startsWith('update') || action.startsWith('delete')) {
      if (typeof saveOfflineQueue === 'function') {
        saveOfflineQueue(action, payload);
        return { success: true, message: 'Koneksi gagal. Data disimpan secara offline di HP Anda.' };
      }
    }
    return { success: false, message: 'Gagal terhubung ke server API. Periksa koneksi internet atau URL Apps Script.' };
  }
}

