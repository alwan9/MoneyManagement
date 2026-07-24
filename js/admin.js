/**
 * AFinTrack - Super Admin Controller (User Management & Permission Matrix Controller)
 */

let adminState = {
  users: [],
  filteredUsers: []
};

document.addEventListener('DOMContentLoaded', async () => {
  checkAuthGuard();
  checkSuperAdminGuard();
  applyPermissionGuards('Admin');
  initUserInfo();
  await loadUsersAndPermissions();
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

function checkSuperAdminGuard() {
  const session = getSession();
  const isSA = session && (session.role === 'Super Admin' || session.role === 'admin' || session.username.toLowerCase() === 'wansmin' || session.username.toLowerCase() === 'admin');
  if (!isSA) {
    showToast('Akses ditolak: Halaman ini khusus untuk Super Admin.', 'error');
    setTimeout(() => {
      window.location.href = './dashboard.html';
    }, 1000);
  }
}

async function loadUsersAndPermissions() {
  const tbody = document.getElementById('admin-table-body');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-zinc-400 text-xs animate-pulse">Memuat daftar pengguna & matriks izin...</td></tr>`;
  }

  showLoading(true);
  const res = await apiCall('getUsersAndPermissions');
  showLoading(false);

  if (res && res.success && Array.isArray(res.data)) {
    adminState.users = res.data;
    adminState.filteredUsers = res.data;
    updateAdminStatsSummary();
    renderAdminTable();
  } else {
    showToast(res ? (res.message || 'Gagal memuat pengguna.') : 'Gagal memuat pengguna.', 'error');
  }
}

function updateAdminStatsSummary() {
  const users = adminState.users;
  const total = users.length;
  const active = users.filter(u => u.Status !== 'Disabled' && u.Status !== 'Inactive').length;
  const admins = users.filter(u => u.Role === 'Super Admin').length;

  const totalEl = document.getElementById('stat-total-users');
  const activeEl = document.getElementById('stat-active-users');
  const adminEl = document.getElementById('stat-admin-count');

  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = active;
  if (adminEl) adminEl.textContent = admins;
}

function filterUsers() {
  const search = (document.getElementById('search-users')?.value || '').toLowerCase();
  adminState.filteredUsers = adminState.users.filter(u =>
    (u.Username || '').toLowerCase().includes(search) ||
    (u.UserID || '').toLowerCase().includes(search)
  );
  renderAdminTable();
}

function renderAdminTable() {
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;

  const session = getSession();
  const currentUsername = session ? (session.username || '').toLowerCase() : '';
  const isCurrentWansmin = currentUsername === 'wansmin';

  const users = adminState.filteredUsers;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-8 text-zinc-400 text-sm">
          Tidak ada pengguna ditemukan.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const p = u.Permissions || {};
    const isSA = u.Role === 'Super Admin';
    const isActive = u.Status !== 'Disabled' && u.Status !== 'Inactive';
    const isWansminUser = (u.Username || '').toLowerCase() === 'wansmin';

    return `
      <tr class="border-b border-zinc-200 dark:border-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition">
        <td class="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl ${isWansminUser ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'} flex items-center justify-center font-bold text-xs uppercase">
            ${u.Username.charAt(0)}
          </div>
          <div>
            <p class="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
              <span>${u.Username}</span>
              ${isWansminUser ? '<span class="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-extrabold border border-amber-500/30">Utama</span>' : ''}
            </p>
            <p class="text-[10px] font-mono text-zinc-400">${u.UserID}</p>
          </div>
        </td>
        <td class="px-4 py-3">
          <select id="role-${u.UserID}" ${isWansminUser ? 'disabled' : ''} class="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold ${isSA ? 'text-indigo-400' : 'text-zinc-300'} ${isWansminUser ? 'opacity-60 cursor-not-allowed' : ''}">
            <option value="User" ${!isSA ? 'selected' : ''}>Member</option>
            <option value="Super Admin" ${isSA ? 'selected' : ''}>Super Admin</option>
          </select>
        </td>
        <td class="px-4 py-3">
          <select id="status-${u.UserID}" ${isWansminUser ? 'disabled' : ''} class="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold ${isActive ? 'text-emerald-500' : 'text-rose-500'} ${isWansminUser ? 'opacity-60 cursor-not-allowed' : ''}">
            <option value="Active" ${isActive ? 'selected' : ''}>Active</option>
            <option value="Disabled" ${!isActive ? 'selected' : ''}>Disabled</option>
          </select>
        </td>
        <td class="px-4 py-3 text-center">
          <input type="checkbox" id="perm-dash-${u.UserID}" ${p.Dashboard !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-4 py-3 text-center">
          <input type="checkbox" id="perm-trade-${u.UserID}" ${p.Trading !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-4 py-3 text-center">
          <input type="checkbox" id="perm-fin-${u.UserID}" ${p.Finance !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-4 py-3 text-center">
          <input type="checkbox" id="perm-crudtrade-${u.UserID}" ${p.CRUDTrading !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-4 py-3 text-center">
          <input type="checkbox" id="perm-crudfin-${u.UserID}" ${p.CRUDFinance !== false ? 'checked' : ''} class="w-4 h-4 accent-indigo-600 rounded">
        </td>
        <td class="px-4 py-3 text-right">
          <div class="flex justify-end gap-1.5">
            <button onclick="resetUserPassword('${u.UserID}', '${u.Username}')" class="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-xl transition flex items-center gap-1 text-[11px] font-semibold" title="Reset Password">
              <iconify-icon icon="lucide:key-round" class="text-sm"></iconify-icon>
            </button>
            <button onclick="saveUserPermissions('${u.UserID}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[11px] shadow transition flex items-center gap-1">
              <iconify-icon icon="lucide:save"></iconify-icon>
              <span>Simpan</span>
            </button>
            ${isCurrentWansmin && !isWansminUser ? `
              <button onclick="deleteUserPermanently('${u.UserID}', '${u.Username}')" class="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 rounded-xl font-bold text-[11px] transition flex items-center gap-1 shadow-sm" title="Hapus Pengguna (Khusus Wansmin)">
                <iconify-icon icon="lucide:trash-2" class="text-sm"></iconify-icon>
                <span>Hapus</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteUserPermanently(targetUserID, username) {
  if (!confirm(`Apakah Anda yakin ingin menghapus pengguna (${username}) secara permanen? Data permission & pengguna akan dihapus!`)) {
    return;
  }

  showLoading(true);
  const res = await apiCall('deleteUser', { targetUserID });
  showLoading(false);

  if (res && res.success) {
    showToast(res.message || `Pengguna ${username} berhasil dihapus!`, 'success');
    await loadUsersAndPermissions();
  } else {
    showToast(res ? (res.message || 'Gagal menghapus pengguna.') : 'Gagal menghapus pengguna.', 'error');
  }
}

async function saveUserPermissions(targetUserID) {
  const role = document.getElementById(`role-${targetUserID}`)?.value || 'User';
  const status = document.getElementById(`status-${targetUserID}`)?.value || 'Active';
  const permissions = {
    Dashboard: document.getElementById(`perm-dash-${targetUserID}`)?.checked || false,
    Trading: document.getElementById(`perm-trade-${targetUserID}`)?.checked || false,
    Finance: document.getElementById(`perm-fin-${targetUserID}`)?.checked || false,
    CRUDTrading: document.getElementById(`perm-crudtrade-${targetUserID}`)?.checked || false,
    CRUDFinance: document.getElementById(`perm-crudfin-${targetUserID}`)?.checked || false
  };

  showLoading(true);
  const res = await apiCall('updateUserPermission', { targetUserID, role, status, permissions });
  showLoading(false);

  if (res && res.success) {
    showToast(res.message || 'Izin & role pengguna diperbarui.', 'success');
    await loadUsersAndPermissions();
  } else {
    showToast(res ? (res.message || 'Gagal memperbarui izin.') : 'Gagal memperbarui izin.', 'error');
  }
}

function resetUserPassword(targetUserID, username) {
  const modal = document.getElementById('reset-password-modal');
  const userIdInput = document.getElementById('reset-user-id');
  const nameDisplay = document.getElementById('reset-username-display');
  const passInput = document.getElementById('reset-new-password');

  if (userIdInput) userIdInput.value = targetUserID;
  if (nameDisplay) nameDisplay.textContent = username;
  if (passInput) passInput.value = '';

  if (modal) modal.classList.remove('hidden');
}

function closeResetPasswordModal() {
  const modal = document.getElementById('reset-password-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleResetPasswordSubmit(e) {
  e.preventDefault();
  const targetUserID = document.getElementById('reset-user-id')?.value;
  const newPass = document.getElementById('reset-new-password')?.value?.trim();

  if (!newPass || newPass.length < 3) {
    showToast('Password minimal 3 karakter.', 'warning');
    return;
  }

  showLoading(true);
  const res = await apiCall('updateUserPermission', { targetUserID, newPassword: newPass });
  showLoading(false);

  if (res && res.success) {
    showToast('Password pengguna berhasil direset! 🔑', 'success');
    closeResetPasswordModal();
  } else {
    showToast(res ? (res.message || 'Gagal mereset password.') : 'Gagal mereset password.', 'error');
  }
}

function openCreateUserModal() {
  const modal = document.getElementById('create-user-modal');
  const passInput = document.getElementById('new-password');
  if (passInput) passInput.value = '';
  if (modal) modal.classList.remove('hidden');
}

function closeCreateUserModal() {
  const modal = document.getElementById('create-user-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateUser(e) {
  e.preventDefault();
  const username = document.getElementById('new-username')?.value?.trim();
  const password = document.getElementById('new-password')?.value?.trim();
  const role = document.getElementById('new-role')?.value || 'User';

  if (!username || !password) {
    showToast('Username dan Password wajib diisi.', 'warning');
    return;
  }

  showLoading(true);
  const res = await apiCall('addUser', { username, password, role });
  showLoading(false);

  if (res && res.success) {
    showToast(res.message || `Akun ${username} berhasil dibuat.`, 'success');
    closeCreateUserModal();
    const form = document.getElementById('create-user-form');
    if (form) form.reset();
    const passInput = document.getElementById('new-password');
    if (passInput) passInput.value = '';
    await loadUsersAndPermissions();
  } else {
    showToast(res ? (res.message || 'Gagal membuat pengguna baru.') : 'Gagal membuat pengguna baru.', 'error');
  }
}
