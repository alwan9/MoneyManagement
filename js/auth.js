/**
 * MoneyM - Authentication & API Dispatcher (High-Grade Security)
 */

// Ubah URL ini menjadi URL Deployment Google Apps Script (Web App) Anda
const MONEYM_API_URL = "";

// Multi-User Session Storage Keys
const SESSION_KEY = "MONEYM_ACTIVE_SESSION";

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

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function logout() {
  clearSession();
  window.location.href = './login.html';
}

function checkAuthGuard() {
  const session = getSession();
  const currentPath = (window.location.pathname || '').toLowerCase();
  const isLoginPage = currentPath.endsWith('login.html') || currentPath.includes('login.html');

  if (!session && !isLoginPage) {
    window.location.href = './login.html';
  } else if (session && isLoginPage) {
    window.location.href = './dashboard.html';
  }
}

const PIN_KEY = "MONEYM_PIN_CODE";

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

  const apiUrl = localStorage.getItem('MONEYM_API_URL') || MONEYM_API_URL || "";

  // Jika URL API belum dikonfigurasi, gunakan Local Mock Engine untuk testing
  if (!apiUrl || apiUrl.trim() === "") {
    console.warn(`[MoneyM API] MONEYM_API_URL kosong, menjalankan Local Mock Engine untuk action: ${action}`);
    return localMockEngine(action, payload);
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
      showToast('Sesi Anda telah kadaluarsa. Silakan login kembali.', 'warning');
      clearSession();
      setTimeout(() => window.location.href = './login.html', 1500);
    }
    return result;
  } catch (error) {
    console.error('[MoneyM API Error]', error);
    if (action.startsWith('add') || action.startsWith('update') || action.startsWith('delete')) {
      if (typeof saveOfflineQueue === 'function') {
        saveOfflineQueue(action, payload);
        return { success: true, message: 'Koneksi gagal. Data disimpan secara offline di HP Anda.' };
      }
    }
    return { success: false, message: 'Gagal terhubung ke server API. Periksa koneksi internet atau URL Apps Script.' };
  }
}

/**
 * Local Mock Engine (High-Grade Security Simulation Mode)
 */
function localMockEngine(action, payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      let users = JSON.parse(localStorage.getItem('MOCK_USERS')) || [
        { UserID: 'USR-ADMIN-001', Username: 'admin', Password: '123', Role: 'Super Admin' },
        { UserID: 'USR-USER-001', Username: 'demo', Password: '123', Role: 'User' }
      ];
      let trading = JSON.parse(localStorage.getItem('MOCK_TRADING')) || [];
      let finance = JSON.parse(localStorage.getItem('MOCK_FINANCE')) || [];

      const currentSession = getSession();
      const currentUserID = currentSession ? currentSession.userID : '';

      switch (action) {
        case 'login': {
          const user = users.find(u =>
            u.Username.toLowerCase() === (payload.username || '').toLowerCase() &&
            u.Password === payload.password
          );
          if (user) {
            const token = 'mock-hmac-token-' + Date.now();
            const sessionData = {
              token: token,
              userID: user.UserID,
              username: user.Username,
              role: user.Role,
              timestamp: Date.now(),
              permissions: { Dashboard: true, Trading: true, Finance: true, CRUDTrading: true, CRUDFinance: true }
            };
            saveSession(sessionData);
            resolve({ success: true, message: 'Login berhasil.', data: sessionData });
          } else {
            resolve({ success: false, message: 'Username atau Password salah.' });
          }
          break;
        }

        case 'getDashboardSummary': {
          const uTrading = trading.filter(t => t.UserID === currentUserID);
          const uFinance = finance.filter(f => f.UserID === currentUserID);

          let totalProfit = 0, totalLoss = 0, winCount = 0;
          uTrading.forEach(t => {
            if (t.Status !== 'RUNNING') {
              const pl = Number(t.ProfitLoss) || 0;
              if (pl > 0) { totalProfit += pl; winCount++; }
              else if (pl < 0) { totalLoss += Math.abs(pl); }
            }
          });
          const closedCount = uTrading.filter(t => t.Status !== 'RUNNING').length;
          const winRate = closedCount > 0 ? ((winCount / closedCount) * 100).toFixed(1) : 0;

          let totalPemasukan = 0, totalPengeluaran = 0;
          uFinance.forEach(f => {
            const nom = Number(f.Nominal) || 0;
            if (f.Jenis === 'Pemasukan') totalPemasukan += nom;
            else totalPengeluaran += nom;
          });

          const totalSaldo = totalPemasukan + (totalProfit - totalLoss) - totalPengeluaran;

          resolve({
            success: true,
            data: {
              totalProfit, totalLoss, winRate: Number(winRate), totalTrades: uTrading.length,
              totalPemasukan, totalPengeluaran, totalSaldo, recentActivities: []
            }
          });
          break;
        }

        case 'getTrading': {
          const items = trading.filter(t => t.UserID === currentUserID);
          resolve({ success: true, data: items });
          break;
        }

        case 'addTrading': {
          const newItem = {
            TradingID: 'TRD-' + Date.now(),
            UserID: currentUserID,
            ...payload
          };
          trading.push(newItem);
          localStorage.setItem('MOCK_TRADING', JSON.stringify(trading));
          resolve({ success: true, message: 'Data trading berhasil disimpan.' });
          break;
        }

        case 'deleteTrading': {
          trading = trading.filter(t => t.TradingID !== payload.tradingID);
          localStorage.setItem('MOCK_TRADING', JSON.stringify(trading));
          resolve({ success: true, message: 'Data trading berhasil dihapus.' });
          break;
        }

        case 'getFinance': {
          const items = finance.filter(f => f.UserID === currentUserID);
          resolve({ success: true, data: items });
          break;
        }

        case 'addFinance': {
          const newItem = {
            FinanceID: 'FIN-' + Date.now(),
            UserID: currentUserID,
            ...payload
          };
          finance.push(newItem);
          localStorage.setItem('MOCK_FINANCE', JSON.stringify(finance));
          resolve({ success: true, message: 'Data keuangan berhasil disimpan.' });
          break;
        }

        case 'deleteFinance': {
          finance = finance.filter(f => f.FinanceID !== payload.financeID);
          localStorage.setItem('MOCK_FINANCE', JSON.stringify(finance));
          resolve({ success: true, message: 'Data keuangan berhasil dihapus.' });
          break;
        }

        case 'getUsersAndPermissions': {
          let perms = JSON.parse(localStorage.getItem('MOCK_PERMISSIONS')) || {};
          const list = users.map(u => ({
            UserID: u.UserID,
            Username: u.Username,
            Role: u.Role,
            Status: 'Active',
            Permissions: perms[u.UserID] || {
              Dashboard: true,
              Trading: true,
              Finance: true,
              CRUDTrading: true,
              CRUDFinance: true
            }
          }));
          resolve({ success: true, data: list });
          break;
        }

        case 'updateUserPermission': {
          let perms = JSON.parse(localStorage.getItem('MOCK_PERMISSIONS')) || {};
          perms[payload.targetUserID] = payload.permissions;
          localStorage.setItem('MOCK_PERMISSIONS', JSON.stringify(perms));

          if (payload.role) {
            const u = users.find(x => x.UserID === payload.targetUserID);
            if (u) u.Role = payload.role;
            localStorage.setItem('MOCK_USERS', JSON.stringify(users));
          }

          resolve({ success: true, message: 'Izin & Role pengguna berhasil diperbarui.' });
          break;
        }

        case 'addUser':
        case 'register': {
          if (!currentSession || (currentSession.role !== 'Super Admin' && currentSession.role !== 'admin')) {
            resolve({ success: false, message: 'Akses ditolak: Hanya Super Admin yang dapat membuat akun baru.' });
            break;
          }

          const existing = users.find(u => u.Username.toLowerCase() === payload.username.toLowerCase());
          if (existing) {
            resolve({ success: false, message: 'Username sudah terdaftar.' });
            break;
          }

          const newUser = {
            UserID: 'USR-' + Date.now(),
            Username: payload.username,
            Password: payload.password || '123',
            Role: payload.role || 'User'
          };
          users.push(newUser);
          localStorage.setItem('MOCK_USERS', JSON.stringify(users));

          resolve({ success: true, message: `Akun pengguna baru (${payload.username}) berhasil dibuat!` });
          break;
        }

        default:
          resolve({ success: true, message: 'Action mock disimulasikan.' });
      }
    }, 200);
  });
}
