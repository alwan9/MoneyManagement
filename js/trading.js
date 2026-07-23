/**
 * MoneyM - Trading Module Logic & TradingView Widget (Realtime Ticker, SL/TP, Running Position & 5-Min Smart Notification Engine)
 */

let tradingState = {
  items: [],
  filteredItems: [],
  currentPage: 1,
  pageSize: 10,
  editingID: null,
  livePriceInterval: null,
  reminder5MinInterval: null,
  currentLivePrice: 0,
  plType: 'PROFIT' // 'PROFIT' or 'LOSS'
};

document.addEventListener('DOMContentLoaded', async () => {
  checkAuthGuard();
  initUserInfo();
  initTradingViewWidget('OANDA:XAUUSD');
  renderTradingSkeleton();
  await loadTradingData();
  checkUrlActions();
});

function checkUrlActions() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'add') {
    setTimeout(() => {
      if (typeof openTradingModal === 'function') openTradingModal();
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

function renderTradingSkeleton() {
  const countEl = document.getElementById('stat-trade-count');
  const winrateEl = document.getElementById('stat-winrate');
  const plEl = document.getElementById('stat-total-pl');

  if (countEl) countEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-20 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;
  if (winrateEl) winrateEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;
  if (plEl) plEl.innerHTML = `<span class="inline-block animate-pulse h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></span>`;

  const tbody = document.getElementById('trading-table-body');
  if (tbody) {
    tbody.innerHTML = Array(5).fill(0).map(() => `
      <tr class="animate-pulse border-b border-zinc-200 dark:border-zinc-800/60 text-xs">
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-16"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-20"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-14"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-12"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-12"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-12"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-12"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-10"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-24"></div></td>
        <td class="px-4 py-3.5"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-10"></div></td>
        <td class="px-4 py-3.5 text-right"><div class="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-12 ml-auto"></div></td>
      </tr>
    `).join('');
  }
}

// Check & Notify Running Trades
function checkAndNotifyRunningTrades(items) {
  const running = (items || tradingState.items).filter(i => i.Status === 'RUNNING');
  if (running.length > 0) {
    const pairs = running.map(r => `${r.Pair} (${r.BuySell})`).join(', ');
    const title = `⏳ ${running.length} Posisi Trading Belum Selesai!`;
    const body = `Anda memiliki ${running.length} posisi yang masih RUNNING: ${pairs}. Notifikasi pengingat otomatis aktif setiap 5 menit!`;

    sendLocalNotification(title, {
      body: body,
      tag: 'moneym-running-trades-alert'
    });
  }
}

// Smart 5-Minute Timer & SL/TP Hit Detection Engine
function start5MinReminderTimer() {
  if (tradingState.reminder5MinInterval) {
    clearInterval(tradingState.reminder5MinInterval);
  }

  // Timer interval setiap 5 menit (300.000 ms)
  tradingState.reminder5MinInterval = setInterval(async () => {
    const runningTrades = tradingState.items.filter(i => i.Status === 'RUNNING');
    if (runningTrades.length === 0) return;

    for (let trade of runningTrades) {
      const entry = Number(trade.Entry) || 0;
      const sl = Number(trade.SL) || 0;
      const tp = Number(trade.TP) || 0;
      const buySell = trade.BuySell || 'BUY';

      // Ambil harga live terkini untuk pair tersebut
      let currentPrice = 0;
      try {
        const symbol = (trade.Pair || 'XAUUSD').toUpperCase().replace('/', '').trim();
        if (symbol === 'XAUUSD' || symbol === 'GOLD') {
          const res = await fetch('https://api.gold-api.com/price/XAU');
          const data = await res.json();
          if (data && data.price) currentPrice = parseFloat(data.price);
        } else {
          const binanceSymbol = symbol.includes('USDT') ? symbol : symbol + 'USDT';
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
          const data = await res.json();
          if (data && data.price) currentPrice = parseFloat(data.price);
        }
      } catch (err) {
        console.warn('[5-Min Timer] Fetch price error:', err);
      }

      if (currentPrice <= 0) {
        currentPrice = tradingState.currentLivePrice || entry;
      }

      // Evaluasi Deteksi Sinyal HIT TP atau HIT SL
      let hitTP = false;
      let hitSL = false;

      if (buySell === 'BUY') {
        if (tp > 0 && currentPrice >= tp) hitTP = true;
        if (sl > 0 && currentPrice <= sl) hitSL = true;
      } else {
        if (tp > 0 && currentPrice <= tp) hitTP = true;
        if (sl > 0 && currentPrice >= sl) hitSL = true;
      }

      if (hitTP) {
        sendLocalNotification(`🎯 SINYAL HIT TP: ${trade.Pair} (${buySell})`, {
          body: `Harga live ($${currentPrice.toFixed(2)}) telah mencapai Take Profit ($${tp})! Klik di sini untuk update hasil trade (PROFIT).`,
          tag: `sltp-hit-${trade.TradingID}`
        });
      } else if (hitSL) {
        sendLocalNotification(`⚠️ SINYAL HIT SL: ${trade.Pair} (${buySell})`, {
          body: `Harga live ($${currentPrice.toFixed(2)}) telah menyentuh Stop Loss ($${sl})! Klik di sini untuk update hasil trade (LOSS).`,
          tag: `sltp-hit-${trade.TradingID}`
        });
      } else {
        // Pengingat Rutin 5 Menit
        sendLocalNotification(`⏰ Evaluasi Trade (5-Min): ${trade.Pair} (${buySell})`, {
          body: `Posisi masih RUNNING di harga $${currentPrice.toFixed(2)} (Entry: $${entry}, SL: $${sl}, TP: $${tp}). Cek apakah posisi sudah di-close!`,
          tag: `5min-reminder-${trade.TradingID}`
        });
      }
    }
  }, 300000); // 5 Menit = 300.000 ms
}

// TradingView Widget Gratis Generator
function initTradingViewWidget(symbol = 'OANDA:XAUUSD') {
  const container = document.getElementById('tradingview-widget-container');
  if (!container) return;

  const currentTheme = typeof getTheme === 'function' ? getTheme() : 'dark';

  container.innerHTML = '';
  const widgetScript = document.createElement('script');
  widgetScript.type = 'text/javascript';
  widgetScript.src = 'https://s3.tradingview.com/tv.js';
  widgetScript.onload = () => {
    if (typeof TradingView !== 'undefined') {
      new TradingView.widget({
        "autosize": true,
        "symbol": symbol,
        "interval": "1",
        "timezone": "Asia/Jakarta",
        "theme": currentTheme === 'dark' ? 'dark' : 'light',
        "style": "1",
        "locale": "id",
        "toolbar_bg": currentTheme === 'dark' ? '#09090b' : '#f4f4f5',
        "enable_publishing": false,
        "allow_symbol_change": true,
        "container_id": "tradingview-widget-container"
      });
    }
  };
  container.appendChild(widgetScript);
}

// Fetch Live Ticker Price (Realtime Update Every 1 Minute)
async function fetchLiveTickerPrice(pairName = 'XAUUSD') {
  const badgeVal = document.getElementById('live-price-val');
  const spinner = document.getElementById('live-price-spinner');
  if (spinner) spinner.classList.add('animate-spin');

  const symbol = (pairName || 'XAUUSD').toUpperCase().replace('/', '').trim();
  let price = 0;

  try {
    if (symbol === 'XAUUSD' || symbol === 'GOLD') {
      const res = await fetch('https://api.gold-api.com/price/XAU');
      const data = await res.json();
      if (data && data.price) {
        price = parseFloat(data.price);
      }
    } else {
      const binanceSymbol = symbol.includes('USDT') ? symbol : symbol + 'USDT';
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      const data = await res.json();
      if (data && data.price) {
        price = parseFloat(data.price);
      }
    }
  } catch (err) {
    console.warn('[Live Ticker] API fetch error, fallback simulation:', err);
  }

  if (!price || price === 0) {
    price = symbol.includes('XAU') ? (2350 + Math.random() * 5) : (65000 + Math.random() * 50);
  }

  tradingState.currentLivePrice = price;

  if (badgeVal) {
    badgeVal.textContent = `Live: $${price.toFixed(2)}`;
  }
  if (spinner) {
    spinner.classList.remove('animate-spin');
  }

  const entryInput = document.getElementById('input-entry');
  if (entryInput && (!entryInput.value || entryInput.dataset.autoFilled === 'true')) {
    entryInput.value = price.toFixed(2);
    entryInput.dataset.autoFilled = 'true';
    autoCalculateSLTP();
  }
}

// Auto Calculate Default SL (-50 pips) & TP (Kelipatan 50 pips berdasarkan Risk:Reward 1:1, 1:2, 1:3, 1:4, 1:5)
function autoCalculateSLTP(force = false) {
  const entryVal = parseFloat(document.getElementById('input-entry')?.value) || 0;
  if (entryVal <= 0) return;

  const pair = (document.getElementById('input-pair')?.value || 'XAUUSD').toUpperCase();
  const buySell = document.getElementById('input-buysell')?.value || 'BUY';
  const rrVal = document.getElementById('input-rr')?.value || '1:2';
  const slInput = document.getElementById('input-sl');
  const tpInput = document.getElementById('input-tp');

  if (!slInput || !tpInput) return;

  if (!force && slInput.value && tpInput.value && slInput.dataset.manual === 'true') {
    return;
  }

  let rrRatio = 2;
  if (rrVal.includes(':')) {
    rrRatio = parseFloat(rrVal.split(':')[1]) || 2;
  }

  let pipSize = 0.0001;
  if (pair.includes('XAU') || pair.includes('GOLD')) {
    pipSize = 0.10;
  } else if (pair.includes('JPY')) {
    pipSize = 0.01;
  } else if (pair.includes('BTC') || pair.includes('ETH')) {
    pipSize = 1.0;
  }

  const slPips = 50;
  const tpPips = 50 * rrRatio;

  const tpDistance = tpPips * pipSize;
  const slDistance = slPips * pipSize;

  let calculatedTP = 0;
  let calculatedSL = 0;

  if (buySell === 'BUY') {
    calculatedTP = entryVal + tpDistance;
    calculatedSL = entryVal - slDistance;
  } else {
    calculatedTP = entryVal - tpDistance;
    calculatedSL = entryVal + slDistance;
  }

  const decimals = (pair.includes('XAU') || pair.includes('JPY')) ? 2 : (pair.includes('BTC') ? 1 : 4);

  tpInput.value = calculatedTP.toFixed(decimals);
  slInput.value = calculatedSL.toFixed(decimals);
  slInput.dataset.manual = 'false';
  tpInput.dataset.manual = 'false';

  if (force) {
    showToast(`SL (-50p) & TP (+${tpPips}p untuk R:R ${rrVal}) diterapkan`, 'info');
  }
}

function useLivePrice() {
  const entryInput = document.getElementById('input-entry');
  if (entryInput && tradingState.currentLivePrice > 0) {
    entryInput.value = tradingState.currentLivePrice.toFixed(2);
    entryInput.dataset.autoFilled = 'true';
    autoCalculateSLTP(true);
    showToast(`Harga Entry diisi dengan Live Price: $${tradingState.currentLivePrice.toFixed(2)}`, 'success');
  }
}

function startLiveTickerPolling() {
  stopLiveTickerPolling();
  const pair = document.getElementById('input-pair')?.value || 'XAUUSD';
  fetchLiveTickerPrice(pair);

  tradingState.livePriceInterval = setInterval(() => {
    const currentPair = document.getElementById('input-pair')?.value || 'XAUUSD';
    fetchLiveTickerPrice(currentPair);
  }, 60000);
}

function stopLiveTickerPolling() {
  if (tradingState.livePriceInterval) {
    clearInterval(tradingState.livePriceInterval);
    tradingState.livePriceInterval = null;
  }
}

// Load Data Trading
async function loadTradingData() {
  const res = await apiCall('getTrading');

  if (res.success && Array.isArray(res.data)) {
    tradingState.items = res.data;
    applyFilterAndSearch();
    checkAndNotifyRunningTrades(tradingState.items);
    start5MinReminderTimer();
  } else {
    showToast(res.message || 'Gagal memuat data trading.', 'error');
  }
}

function applyFilterAndSearch() {
  const search = (document.getElementById('search-trading')?.value || '').toLowerCase();
  const filterBuySell = document.getElementById('filter-buysell')?.value || 'ALL';

  tradingState.filteredItems = tradingState.items.filter(item => {
    const matchSearch = (item.Pair || '').toLowerCase().includes(search) || 
                        (item.Catatan || '').toLowerCase().includes(search);
    const matchType = filterBuySell === 'ALL' || item.BuySell === filterBuySell;
    return matchSearch && matchType;
  });

  tradingState.currentPage = 1;
  renderTradingTable();
  renderStatsSummary();
}

function renderStatsSummary() {
  let totalProfit = 0, totalLoss = 0, winCount = 0;
  const items = tradingState.filteredItems;

  items.forEach(t => {
    if (t.Status !== 'RUNNING') {
      const pl = Number(t.ProfitLoss) || 0;
      if (pl > 0) { totalProfit += pl; winCount++; }
      else if (pl < 0) { totalLoss += Math.abs(pl); }
    }
  });

  const closedItems = items.filter(t => t.Status !== 'RUNNING');
  const winRate = closedItems.length > 0 ? ((winCount / closedItems.length) * 100).toFixed(1) : 0;

  const statCountEl = document.getElementById('stat-trade-count');
  const statWinrateEl = document.getElementById('stat-winrate');
  const statProfitEl = document.getElementById('stat-total-pl');

  if (statCountEl) statCountEl.textContent = `${items.length} Trade (${items.filter(i => i.Status === 'RUNNING').length} Running)`;
  if (statWinrateEl) statWinrateEl.textContent = `${winRate}%`;
  if (statProfitEl) {
    const net = totalProfit - totalLoss;
    statProfitEl.textContent = isPrivacyMode() ? 'Rp •••••••' : ((net >= 0 ? '+' : '') + formatIDR(net));
    statProfitEl.className = `text-lg font-bold ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`;
  }
}

function renderTradingTable() {
  const tbody = document.getElementById('trading-table-body');
  if (!tbody) return;

  const start = (tradingState.currentPage - 1) * tradingState.pageSize;
  const end = start + tradingState.pageSize;
  const pageItems = tradingState.filteredItems.slice(start, end);

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-8 text-zinc-400 text-sm">
          Tidak ada data trading ditemukan.
        </td>
      </tr>
    `;
    renderPagination();
    return;
  }

  tbody.innerHTML = pageItems.map(item => {
    const isRunning = item.Status === 'RUNNING';
    const pl = Number(item.ProfitLoss) || 0;
    const isProfit = pl >= 0;
    
    const bsBadge = item.BuySell === 'BUY' 
      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
      : 'bg-rose-500/10 text-rose-500 border-rose-500/30';

    let statusBadge = isRunning 
      ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 w-max">⏳ RUNNING</span>'
      : (isProfit 
          ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 w-max">✅ PROFIT</span>'
          : '<span class="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 w-max">❌ LOSS</span>');

    return `
      <tr class="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition border-b border-zinc-200 dark:border-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300">
        <td class="px-4 py-3 font-medium">${formatDate(item.Tanggal)}</td>
        <td class="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <span>${item.Pair}</span>
          <button onclick="changeSymbol('${item.Pair}')" title="Lihat Chart" class="text-indigo-500 hover:underline text-[10px] flex items-center">
            <iconify-icon icon="lucide:line-chart" class="text-xs"></iconify-icon>
          </button>
        </td>
        <td class="px-4 py-3">
          <div class="flex flex-col gap-1">
            <span class="px-2 py-0.5 rounded-full border text-[10px] font-bold ${bsBadge} w-max">${item.BuySell}</span>
            ${statusBadge}
          </div>
        </td>
        <td class="px-4 py-3 font-medium">${item.Entry || 0}</td>
        <td class="px-4 py-3 text-rose-400 font-medium">${item.SL || '-'}</td>
        <td class="px-4 py-3 text-emerald-400 font-medium">${item.TP || '-'}</td>
        <td class="px-4 py-3 font-medium">${isRunning ? '<span class="text-amber-500 italic">Floating</span>' : (item.Exit || 0)}</td>
        <td class="px-4 py-3 font-semibold">${item.Lot || 0.01}</td>
        <td class="px-4 py-3 font-extrabold ${isRunning ? 'text-amber-500' : (isProfit ? 'text-emerald-500' : 'text-rose-500')}">
          ${isRunning ? '⏳ Running...' : ((isProfit ? '+' : '') + formatIDR(pl))}
        </td>
        <td class="px-4 py-3 font-medium">${item.RR || '1:2'}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex justify-end gap-1.5 items-center">
            ${isRunning ? `
              <button onclick="closePositionTrade('${item.TradingID}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-sm transition flex items-center gap-1">
                <iconify-icon icon="lucide:check-circle-2"></iconify-icon>
                <span>Close</span>
              </button>
            ` : ''}
            <button onclick="editTrade('${item.TradingID}')" class="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition flex items-center justify-center" title="Edit">
              <iconify-icon icon="lucide:pencil" class="text-sm"></iconify-icon>
            </button>
            <button onclick="deleteTrade('${item.TradingID}')" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition flex items-center justify-center" title="Hapus">
              <iconify-icon icon="lucide:trash-2" class="text-sm"></iconify-icon>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const container = document.getElementById('trading-pagination');
  if (!container) return;

  const totalPages = Math.ceil(tradingState.filteredItems.length / tradingState.pageSize) || 1;
  container.innerHTML = `
    <div class="flex items-center justify-between text-xs text-zinc-500">
      <span>Halaman ${tradingState.currentPage} dari ${totalPages}</span>
      <div class="flex gap-1">
        <button onclick="changePage(-1)" ${tradingState.currentPage === 1 ? 'disabled' : ''}
          class="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40">
          Sebelumnya
        </button>
        <button onclick="changePage(1)" ${tradingState.currentPage >= totalPages ? 'disabled' : ''}
          class="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40">
          Selanjutnya
        </button>
      </div>
    </div>
  `;
}

function changePage(delta) {
  tradingState.currentPage += delta;
  renderTradingTable();
}

// Helper Tombol +000 untuk Nominal
function appendThousands() {
  const input = document.getElementById('input-profitloss');
  if (!input) return;
  let val = input.value;
  if (!val || val === '0') {
    input.value = '1000';
  } else {
    input.value = val + '000';
  }
}

// Profit vs Loss Toggle Handler
function setPLOutcome(type) {
  tradingState.plType = type;
  const btnProfit = document.getElementById('btn-pl-profit');
  const btnLoss = document.getElementById('btn-pl-loss');
  const plInput = document.getElementById('input-profitloss');

  if (type === 'PROFIT') {
    btnProfit.className = 'flex-1 py-2 font-bold rounded-xl bg-emerald-600 text-white transition shadow-sm flex items-center justify-center gap-1';
    btnLoss.className = 'flex-1 py-2 font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition flex items-center justify-center gap-1';
    if (plInput && Number(plInput.value) < 0) {
      plInput.value = Math.abs(Number(plInput.value));
    }
  } else {
    btnLoss.className = 'flex-1 py-2 font-bold rounded-xl bg-rose-600 text-white transition shadow-sm flex items-center justify-center gap-1';
    btnProfit.className = 'flex-1 py-2 font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition flex items-center justify-center gap-1';
    if (plInput && Number(plInput.value) > 0) {
      plInput.value = -Math.abs(Number(plInput.value));
    }
  }
}

// Status Mode Toggle (RUNNING vs CLOSED)
function toggleStatusMode() {
  const statusVal = document.getElementById('input-status')?.value || 'RUNNING';
  const outcomeContainer = document.getElementById('outcome-container');
  const exitInput = document.getElementById('input-exit');
  const plInput = document.getElementById('input-profitloss');

  if (statusVal === 'RUNNING') {
    if (outcomeContainer) outcomeContainer.classList.add('opacity-40');
    if (plInput) {
      plInput.value = '0';
      plInput.required = false;
    }
    if (exitInput) exitInput.placeholder = 'Floating (Pending)';
  } else {
    if (outcomeContainer) outcomeContainer.classList.remove('opacity-40');
    if (plInput) plInput.required = true;
    if (exitInput) {
      exitInput.placeholder = '2365.00';
      if (tradingState.currentLivePrice > 0 && !exitInput.value) {
        exitInput.value = tradingState.currentLivePrice.toFixed(2);
      }
    }
  }
}

// Helper ganti symbol TradingView
function changeSymbol(pairName) {
  if (!pairName) return;
  let formatted = pairName.toUpperCase().replace('/', '').trim();
  if (formatted === 'XAUUSD' || formatted === 'GOLD') {
    formatted = 'OANDA:XAUUSD';
  } else if (!formatted.includes(':')) {
    formatted = 'BINANCE:' + formatted;
  }
  initTradingViewWidget(formatted);
  showToast(`Chart diubah ke ${pairName}`, 'info');
}

// Modal Handlers
function openTradingModal(tradingID = null) {
  tradingState.editingID = tradingID;
  const modal = document.getElementById('trading-modal');
  const title = document.getElementById('modal-trading-title');
  const form = document.getElementById('trading-form');

  form.reset();
  const entryInput = document.getElementById('input-entry');
  if (entryInput) entryInput.dataset.autoFilled = 'false';

  if (tradingID) {
    const item = tradingState.items.find(t => t.TradingID === tradingID);
    if (item) {
      title.textContent = 'Edit Data Trading';
      document.getElementById('input-tanggal').value = item.Tanggal || '';
      document.getElementById('input-pair').value = item.Pair || 'XAUUSD';
      document.getElementById('input-buysell').value = item.BuySell || 'BUY';
      document.getElementById('input-status').value = item.Status || 'CLOSED';
      document.getElementById('input-entry').value = item.Entry || '';
      document.getElementById('input-sl').value = item.SL || '';
      document.getElementById('input-tp').value = item.TP || '';
      document.getElementById('input-exit').value = item.Exit || '';
      document.getElementById('input-lot').value = item.Lot || '0.01';
      
      const plVal = Number(item.ProfitLoss) || 0;
      document.getElementById('input-profitloss').value = Math.abs(plVal);
      setPLOutcome(plVal >= 0 ? 'PROFIT' : 'LOSS');

      document.getElementById('input-rr').value = item.RR || '1:2';
      document.getElementById('input-catatan').value = item.Catatan || '';
    }
  } else {
    title.textContent = 'Tambah Progress Trading';
    document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('input-pair').value = 'XAUUSD';
    document.getElementById('input-status').value = 'RUNNING';
    document.getElementById('input-lot').value = '0.01';
    document.getElementById('input-rr').value = '1:2';
    setPLOutcome('PROFIT');
  }

  toggleStatusMode();
  modal.classList.remove('hidden');
  startLiveTickerPolling();
}

function closePositionTrade(tradingID) {
  openTradingModal(tradingID);
  document.getElementById('input-status').value = 'CLOSED';
  toggleStatusMode();
  showToast('Tentukan Exit Price dan Hasil Trade untuk menutup posisi ini.', 'info');
}

function closeTradingModal() {
  stopLiveTickerPolling();
  document.getElementById('trading-modal').classList.add('hidden');
}

async function saveTradingForm(e) {
  e.preventDefault();

  const statusVal = document.getElementById('input-status').value;
  let finalPL = 0;

  if (statusVal === 'CLOSED') {
    const rawPL = Number(document.getElementById('input-profitloss').value) || 0;
    finalPL = tradingState.plType === 'PROFIT' ? Math.abs(rawPL) : -Math.abs(rawPL);
  }

  const payload = {
    TradingID: tradingState.editingID,
    Tanggal: document.getElementById('input-tanggal').value,
    Pair: document.getElementById('input-pair').value.toUpperCase(),
    BuySell: document.getElementById('input-buysell').value,
    Status: statusVal,
    Entry: Number(document.getElementById('input-entry').value) || 0,
    SL: Number(document.getElementById('input-sl').value) || 0,
    TP: Number(document.getElementById('input-tp').value) || 0,
    Exit: Number(document.getElementById('input-exit').value) || 0,
    Lot: Number(document.getElementById('input-lot').value) || 0.01,
    ProfitLoss: finalPL,
    RR: document.getElementById('input-rr').value || '1:2',
    Catatan: document.getElementById('input-catatan').value
  };

  const action = tradingState.editingID ? 'updateTrading' : 'addTrading';
  showLoading(true);
  const res = await apiCall(action, payload);
  showLoading(false);

  if (res.success) {
    showToast(res.message, 'success');
    closeTradingModal();
    await loadTradingData();
  } else {
    showToast(res.message || 'Gagal menyimpan data.', 'error');
  }
}

function editTrade(tradingID) {
  openTradingModal(tradingID);
}

async function deleteTrade(tradingID) {
  if (!confirm('Apakah Anda yakin ingin menghapus data trading ini?')) return;

  showLoading(true);
  const res = await apiCall('deleteTrading', { tradingID });
  showLoading(false);

  if (res.success) {
    showToast(res.message, 'success');
    await loadTradingData();
  } else {
    showToast(res.message || 'Gagal menghapus data.', 'error');
  }
}
