/**
 * MoneyM - Finance Module Logic Controller (with Skeleton Animate Loading)
 */

let financeState = {
  items: [],
  filteredItems: [],
  currentPage: 1,
  pageSize: 10,
  editingID: null
};

document.addEventListener('DOMContentLoaded', async () => {
  checkAuthGuard();
  initUserInfo();
  renderFinanceSkeleton();
  await loadFinanceData();
  checkUrlActions();
});

function checkUrlActions() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'add') {
    setTimeout(() => {
      if (typeof openFinanceModal === 'function') openFinanceModal();
    }, 500);
  }
}

function initUserInfo() {
  const session = getSession();
  if (session) {
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    if (nameEl) nameEl.textContent = session.username;
    if (roleEl) roleEl.textContent = session.role;

    if (session.role === 'Super Admin' || session.role === 'admin' || session.username.toLowerCase() === 'admin') {
      const navLink = document.getElementById('nav-admin-link');
      if (navLink) navLink.classList.remove('hidden');
      const mobileLink = document.getElementById('mobile-admin-link');
      if (mobileLink) mobileLink.classList.remove('hidden');
    }
  }
}

function renderFinanceSkeleton() {
  const inEl = document.getElementById('stat-total-pemasukan');
  const outEl = document.getElementById('stat-total-pengeluaran');
  const balEl = document.getElementById('stat-saldo-bersih');

  if (inEl) inEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;
  if (outEl) outEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;
  if (balEl) balEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-28 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;

  const tbody = document.getElementById('finance-table-body');
  if (tbody) {
    tbody.innerHTML = Array(5).fill(0).map(() => `
      <tr class="animate-pulse border-b border-zinc-200 dark:border-zinc-800/60 text-xs">
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-16"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-20"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-16"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-24"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-32"></div></td>
        <td class="px-4 py-3.5 text-right"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-12 ml-auto"></div></td>
      </tr>
    `).join('');
  }
}

// Helper Tombol +000 untuk Nominal Keuangan
function appendFinanceThousands() {
  const input = document.getElementById('input-nominal');
  if (!input) return;
  let val = input.value;
  if (!val || val === '0') {
    input.value = '1000';
  } else {
    input.value = val + '000';
  }
}

// Load Data Keuangan
async function loadFinanceData() {
  const res = await apiCall('getFinance');

  if (res.success && Array.isArray(res.data)) {
    financeState.items = res.data;
    applyFinanceFilterAndSearch();
  } else {
    showToast(res.message || 'Gagal memuat data keuangan.', 'error');
  }
}

function applyFinanceFilterAndSearch() {
  const search = (document.getElementById('search-finance')?.value || '').toLowerCase();
  const filterJenis = document.getElementById('filter-jenis')?.value || 'ALL';

  financeState.filteredItems = financeState.items.filter(item => {
    const matchSearch = (item.Kategori || '').toLowerCase().includes(search) ||
      (item.Keterangan || '').toLowerCase().includes(search);
    const matchJenis = filterJenis === 'ALL' || item.Jenis === filterJenis;
    return matchSearch && matchJenis;
  });

  financeState.currentPage = 1;
  renderFinanceTable();
  renderFinanceStatsSummary();
}

function renderFinanceStatsSummary() {
  let totalIn = 0, totalOut = 0;
  financeState.filteredItems.forEach(item => {
    const nom = Number(item.Nominal) || 0;
    if (item.Jenis === 'Pemasukan') totalIn += nom;
    else if (item.Jenis === 'Pengeluaran') totalOut += nom;
  });

  const inEl = document.getElementById('stat-total-pemasukan');
  const outEl = document.getElementById('stat-total-pengeluaran');
  const balEl = document.getElementById('stat-saldo-bersih');

  if (inEl) inEl.textContent = formatPrivacyIDR(totalIn);
  if (outEl) outEl.textContent = formatPrivacyIDR(totalOut);
  if (balEl) {
    const net = totalIn - totalOut;
    balEl.textContent = isPrivacyMode() ? 'Rp •••••••' : ((net >= 0 ? '+' : '') + formatIDR(net));
    balEl.className = `text-lg font-bold ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`;
  }
}

function renderFinanceTable() {
  const tbody = document.getElementById('finance-table-body');
  if (!tbody) return;

  const start = (financeState.currentPage - 1) * financeState.pageSize;
  const end = start + financeState.pageSize;
  const pageItems = financeState.filteredItems.slice(start, end);

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-zinc-400 text-sm">
          Tidak ada data keuangan ditemukan.
        </td>
      </tr>
    `;
    renderFinancePagination();
    return;
  }

  tbody.innerHTML = pageItems.map(item => {
    const isIn = item.Jenis === 'Pemasukan';
    const isRecurring = item.Keterangan && item.Keterangan.includes('[Tagihan Rutin]');
    const badgeColor = isIn
      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
      : 'bg-rose-500/10 text-rose-500 border-rose-500/30';

    const formattedNominal = isPrivacyMode() ? 'Rp •••••••' : ((isIn ? '+' : '-') + formatIDR(item.Nominal));

    return `
      <tr class="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition border-b border-zinc-200 dark:border-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300">
        <td class="px-4 py-3 font-medium">${formatDate(item.Tanggal)}</td>
        <td class="px-4 py-3">
          <span class="px-2.5 py-1 rounded-full border text-[10px] font-bold ${badgeColor}">
            ${item.Jenis}
          </span>
        </td>
        <td class="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <span>${item.Kategori}</span>
          ${isRecurring ? '<span class="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[9px] font-bold rounded-md flex items-center gap-0.5"><iconify-icon icon="lucide:refresh-cw"></iconify-icon> Rutin</span>' : ''}
        </td>
        <td class="px-4 py-3 font-extrabold ${isIn ? 'text-emerald-500' : 'text-rose-500'}">
          ${formattedNominal}
        </td>
        <td class="px-4 py-3 text-zinc-500 dark:text-zinc-400">${item.Keterangan ? item.Keterangan.replace('[Tagihan Rutin]', '').trim() : '-'}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex justify-end gap-1">
            <button onclick="editFinance('${item.FinanceID}')" class="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition flex items-center justify-center" title="Edit">
              <iconify-icon icon="lucide:pencil" class="text-sm"></iconify-icon>
            </button>
            <button onclick="deleteFinance('${item.FinanceID}')" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition flex items-center justify-center" title="Hapus">
              <iconify-icon icon="lucide:trash-2" class="text-sm"></iconify-icon>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderFinancePagination();
}

function renderFinancePagination() {
  const container = document.getElementById('finance-pagination');
  if (!container) return;

  const totalPages = Math.ceil(financeState.filteredItems.length / financeState.pageSize) || 1;
  container.innerHTML = `
    <div class="flex items-center justify-between text-xs text-zinc-500">
      <span>Halaman ${financeState.currentPage} dari ${totalPages}</span>
      <div class="flex gap-1">
        <button onclick="changeFinancePage(-1)" ${financeState.currentPage === 1 ? 'disabled' : ''}
          class="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40">
          Sebelumnya
        </button>
        <button onclick="changeFinancePage(1)" ${financeState.currentPage >= totalPages ? 'disabled' : ''}
          class="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40">
          Selanjutnya
        </button>
      </div>
    </div>
  `;
}

function changeFinancePage(delta) {
  financeState.currentPage += delta;
  renderFinanceTable();
}

function openFinanceModal(financeID = null) {
  financeState.editingID = financeID;
  const modal = document.getElementById('finance-modal');
  const title = document.getElementById('modal-finance-title');
  const form = document.getElementById('finance-form');

  form.reset();

  if (financeID) {
    const item = financeState.items.find(f => f.FinanceID === financeID);
    if (item) {
      title.textContent = 'Edit Transaksi Keuangan';
      document.getElementById('input-tanggal').value = item.Tanggal || '';
      document.getElementById('input-jenis').value = item.Jenis || 'Pengeluaran';
      document.getElementById('input-kategori').value = item.Kategori || 'Makan';
      document.getElementById('input-nominal').value = item.Nominal || '';
      const ket = item.Keterangan || '';
      const isRec = ket.includes('[Tagihan Rutin]');
      document.getElementById('input-keterangan').value = ket.replace('[Tagihan Rutin]', '').trim();
      const recCheck = document.getElementById('input-is-recurring');
      if (recCheck) recCheck.checked = isRec;
    }
  } else {
    title.textContent = 'Tambah Transaksi Keuangan';
    document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('input-jenis').value = 'Pengeluaran';
    document.getElementById('input-kategori').value = 'Makan';
    const recCheck = document.getElementById('input-is-recurring');
    if (recCheck) recCheck.checked = false;
  }

  modal.classList.remove('hidden');
}

function closeFinanceModal() {
  document.getElementById('finance-modal').classList.add('hidden');
}

async function saveFinanceForm(e) {
  e.preventDefault();

  let keterangan = document.getElementById('input-keterangan').value || '';
  const isRecurring = document.getElementById('input-is-recurring')?.checked;

  if (isRecurring && !keterangan.includes('[Tagihan Rutin]')) {
    keterangan = (keterangan + ' [Tagihan Rutin]').trim();
  }

  const payload = {
    FinanceID: financeState.editingID,
    Tanggal: document.getElementById('input-tanggal').value,
    Jenis: document.getElementById('input-jenis').value,
    Kategori: document.getElementById('input-kategori').value,
    Nominal: Number(document.getElementById('input-nominal').value) || 0,
    Keterangan: keterangan
  };

  const action = financeState.editingID ? 'updateFinance' : 'addFinance';
  showLoading(true);
  const res = await apiCall(action, payload);
  showLoading(false);

  if (res.success) {
    showToast(res.message, 'success');
    closeFinanceModal();
    await loadFinanceData();
  } else {
    showToast(res.message || 'Gagal menyimpan data.', 'error');
  }
}

function editFinance(financeID) {
  openFinanceModal(financeID);
}

async function deleteFinance(financeID) {
  if (!confirm('Apakah Anda yakin ingin menghapus data transaksi ini?')) return;

  showLoading(true);
  const res = await apiCall('deleteFinance', { financeID });
  showLoading(false);

  if (res.success) {
    showToast(res.message, 'success');
    await loadFinanceData();
  } else {
    showToast(res.message || 'Gagal menghapus data.', 'error');
  }
}
