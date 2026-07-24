/**
 * MoneyM - Dashboard Logic Controller (with Super Admin User Creation & Permission Matrix Management)
 */

document.addEventListener('DOMContentLoaded', async () => {
  checkAuthGuard();
  applyPermissionGuards('Dashboard');
  initUserInfo();
  checkSuperAdmin();
  renderDashboardSkeleton();
  await loadDashboardData();
});

function initUserInfo() {
  const session = getSession();
  if (session) {
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    if (nameEl) nameEl.textContent = session.username;
    if (roleEl) roleEl.textContent = session.role;
  }
}

function checkSuperAdmin() {
  const session = getSession();
  if (session && (session.role === 'Super Admin' || session.role === 'admin' || session.username.toLowerCase() === 'wansmin' || session.username.toLowerCase() === 'admin')) {
    const banner = document.getElementById('superadmin-banner');
    if (banner) banner.classList.remove('hidden');

    const navLink = document.getElementById('nav-admin-link');
    if (navLink) navLink.classList.remove('hidden');

    const mobileLink = document.getElementById('mobile-admin-link');
    if (mobileLink) mobileLink.classList.remove('hidden');
  }
}

function renderDashboardSkeleton() {
  const profitEl = document.getElementById('dash-profit');
  const lossEl = document.getElementById('dash-loss');
  const winRateEl = document.getElementById('dash-winrate');
  const saldoEl = document.getElementById('dash-saldo');

  if (profitEl) profitEl.innerHTML = `<span class="inline-block animate-pulse h-7 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></span>`;
  if (lossEl) lossEl.innerHTML = `<span class="inline-block animate-pulse h-7 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></span>`;
  if (winRateEl) winRateEl.innerHTML = `<span class="inline-block animate-pulse h-7 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></span>`;
  if (saldoEl) saldoEl.innerHTML = `<span class="inline-block animate-pulse h-7 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></span>`;

  const container = document.getElementById('recent-activity-list');
  if (container) {
    container.innerHTML = Array(4).fill(0).map(() => `
      <div class="animate-pulse flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-zinc-300 dark:bg-zinc-700/60 rounded-xl"></div>
          <div class="space-y-1.5">
            <div class="h-3.5 bg-zinc-300 dark:bg-zinc-700/60 rounded w-36"></div>
            <div class="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded w-24"></div>
          </div>
        </div>
        <div class="h-4 bg-zinc-300 dark:bg-zinc-700/60 rounded w-20"></div>
      </div>
    `).join('');
  }
}

async function loadDashboardData() {
  const res = await apiCall('getDashboardSummary');

  if (res.success && res.data) {
    const d = res.data;

    const totalProfitEl = document.getElementById('dash-profit');
    const totalLossEl = document.getElementById('dash-loss');
    const winRateEl = document.getElementById('dash-winrate');
    const totalTradesEl = document.getElementById('dash-total-trades');
    const totalSaldoEl = document.getElementById('dash-saldo');

    if (totalProfitEl) totalProfitEl.textContent = formatPrivacyIDR(d.totalProfit);
    if (totalLossEl) totalLossEl.textContent = formatPrivacyIDR(d.totalLoss);
    if (winRateEl) winRateEl.textContent = `${d.winRate}%`;
    if (totalTradesEl) totalTradesEl.textContent = `${d.totalTrades} Trade`;
    if (totalSaldoEl) totalSaldoEl.textContent = formatPrivacyIDR(d.totalSaldo);

    renderRecentActivity(d.recentActivities || []);
  } else {
    showToast(res.message || 'Gagal memuat data dashboard.', 'error');
  }
}

function renderRecentActivity(activities) {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-zinc-400 text-sm">
        Belum ada aktivitas tercatat. Tambahkan data di menu Trading atau Keuangan.
      </div>
    `;
    return;
  }

  container.innerHTML = activities.map(act => {
    const isProfit = act.amount >= 0;
    const badgeColor = act.type === 'TRADING'
      ? (isProfit ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border-rose-500/30')
      : (isProfit ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30');

    const iconName = act.type === 'TRADING' ? 'lucide:candlestick-chart' : 'lucide:receipt';
    const formattedAmount = isPrivacyMode() ? 'Rp •••••••' : ((isProfit ? '+' : '') + formatIDR(act.amount));

    return `
      <div class="flex items-center justify-between p-4 bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl border flex items-center justify-center ${badgeColor}">
            <iconify-icon icon="${iconName}" class="text-lg"></iconify-icon>
          </div>
          <div>
            <h4 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">${act.title}</h4>
            <p class="text-xs text-zinc-400">${formatDate(act.date)} • ${act.type}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="text-sm font-bold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}">
            ${formattedAmount}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Modal Permission Handlers (Super Admin)
async function openPermissionModal() {
  const modal = document.getElementById('permission-modal');
  if (modal) modal.classList.remove('hidden');
  await loadUsersPermissions();
}

function closePermissionModal() {
  const modal = document.getElementById('permission-modal');
  if (modal) modal.classList.add('hidden');
}

async function createNewUserByAdmin(e) {
  e.preventDefault();
  const username = document.getElementById('new-user-username')?.value?.trim();
  const password = document.getElementById('new-user-password')?.value?.trim();
  const role = document.getElementById('new-user-role')?.value || 'User';

  if (!username || !password) {
    showToast('Username dan Password wajib diisi.', 'warning');
    return;
  }

  showLoading(true);
  const res = await apiCall('addUser', { username, password, role });
  showLoading(false);

  if (res.success) {
    showToast(res.message, 'success');
    document.getElementById('create-user-form')?.reset();
    await loadUsersPermissions();
  } else {
    showToast(res.message || 'Gagal membuat pengguna baru.', 'error');
  }
}

async function loadUsersPermissions() {
  const tbody = document.getElementById('permission-table-body');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-zinc-400 text-xs animate-pulse">Memuat daftar pengguna & matriks izin...</td></tr>`;
  }

  showLoading(true);
  const res = await apiCall('getUsersAndPermissions');
  showLoading(false);

  if (res.success && Array.isArray(res.data)) {
    renderPermissionTable(res.data);
  } else {
    showToast(res.message || 'Gagal memuat daftar pengguna.', 'error');
  }
}

function renderPermissionTable(users) {
  const tbody = document.getElementById('permission-table-body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-zinc-400 text-xs">Belum ada pengguna terdaftar.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const p = u.Permissions || {};
    const isSA = u.Role === 'Super Admin';

    return `
      <tr class="border-b border-zinc-200 dark:border-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition">
        <td class="px-3 py-3 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
            ${u.Username.charAt(0)}
          </div>
          <span>${u.Username}</span>
        </td>
        <td class="px-3 py-3">
          <select id="role-${u.UserID}" class="px-2 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[11px] font-bold ${isSA ? 'text-indigo-400' : 'text-zinc-400'}">
            <option value="User" ${!isSA ? 'selected' : ''}>Member</option>
            <option value="Super Admin" ${isSA ? 'selected' : ''}>Super Admin</option>
          </select>
        </td>
        <td class="px-3 py-3 text-center">
          <input type="checkbox" id="perm-dash-${u.UserID}" ${p.Dashboard !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-3 py-3 text-center">
          <input type="checkbox" id="perm-trade-${u.UserID}" ${p.Trading !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-3 py-3 text-center">
          <input type="checkbox" id="perm-fin-${u.UserID}" ${p.Finance !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-3 py-3 text-center">
          <input type="checkbox" id="perm-crudtrade-${u.UserID}" ${p.CRUDTrading !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-3 py-3 text-center">
          <input type="checkbox" id="perm-crudfin-${u.UserID}" ${p.CRUDFinance !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-3 py-3 text-right">
          <button onclick="saveUserPermission('${u.UserID}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[10px] shadow transition flex items-center gap-1 ml-auto">
            <iconify-icon icon="lucide:save"></iconify-icon>
            <span>Simpan</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function saveUserPermission(targetUserID) {
  const role = document.getElementById(`role-${targetUserID}`)?.value || 'User';
  const permissions = {
    Dashboard: document.getElementById(`perm-dash-${targetUserID}`)?.checked || false,
    Trading: document.getElementById(`perm-trade-${targetUserID}`)?.checked || false,
    Finance: document.getElementById(`perm-fin-${targetUserID}`)?.checked || false,
    CRUDTrading: document.getElementById(`perm-crudtrade-${targetUserID}`)?.checked || false,
    CRUDFinance: document.getElementById(`perm-crudfin-${targetUserID}`)?.checked || false
  };

  showLoading(true);
  const res = await apiCall('updateUserPermission', { targetUserID, role, permissions });
  showLoading(false);

  if (res.success) {
    showToast(res.message, 'success');
  } else {
    showToast(res.message || 'Gagal memperbarui izin.', 'error');
  }
}
