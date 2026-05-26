// app.js - logic chính Fin2win (v3 - 19/5)
'use strict';

// Tiền mặt đứng đầu; 4 khoản đầu tư mỗi khoản kỳ vọng 10% (tiền mặt 60%)
const ASSET_ALLOCATION = [
  { id: 'cash',    name: 'Tiền mặt',     ratio: 0.60, invest: false },
  { id: 'stock',   name: 'Chứng khoán',  ratio: 0.10, invest: true },
  { id: 'savings', name: 'Gửi tiết kiệm', ratio: 0.10, invest: true },
  { id: 'gold',    name: 'Vàng',         ratio: 0.10, invest: true },
  { id: 'usd',     name: 'USD',          ratio: 0.10, invest: true },
];
const INVEST_IDS = ASSET_ALLOCATION.filter(a => a.invest).map(a => a.id);
const GOLD_TYPES = [
  { id: 'SJC',      label: 'Vàng SJC',         unit: 'VND / lượng', kind: 'gold' },
  { id: 'PNJ-9999', label: 'Vàng PNJ 9999',    unit: 'VND / lượng', kind: 'gold' },
  { id: 'XAU',      label: 'Vàng XAU quốc tế', unit: 'USD / oz',    kind: 'gold' },
];

let data = loadData();
const charts = {};

// state cho điều hướng thời gian — KHÔNG reset giữa các re-render
const nav = {
  income: thisMonthKey(),       // tháng đang xem ở tab thu
  expense: thisMonthKey(),      // tháng đang xem ở tab chi
  income12End: thisMonthKey(),  // bảng 12T thu - tháng cuối
  expense12End: thisMonthKey(), // bảng 12T chi - tháng cuối
  dashEnd: thisMonthKey(),      // bảng 12T tổng quan
  cashflowEnd: thisMonthKey(),  // bảng 12T cashflow
  cashflowMonth: thisMonthKey(),// stat tiền ròng tháng (chọn)
  overviewCat: 'currency',
  overviewPeriod: '1D',
  overviewSelected: null,
  marketGroup: 'VN30',
  pickerGroup: 'HOSE',
  pickerSlot: -1,               // index slot đang chọn (vô hạn)
  investMonth: thisMonthKey(),  // tháng đầu tư đang xem
  stockView: 'month',           // 'month' | 'cum'
  goldUsdView: 'month',
  growthYears: 5,
};

let nameCombobox = null;

// ---------- helpers ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const todayStr = () => new Date().toISOString().slice(0, 10);
function thisMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthKey(s) { return s.slice(0, 7); }
function monthLabel(k) { const [y, m] = k.split('-'); return `${m}/${y}`; }
function dateLabel(s) {
  // 'YYYY-MM-DD' → 'DD/MM/YYYY'
  if (!s) return '';
  const [y, m, d] = s.split('-');
  if (!d) return s;
  return `${d}/${m}/${y}`;
}
function shiftMonth(k, delta) {
  const [y, m] = k.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function persist() { saveData(data); }

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function txInDisplay(tx) {
  return convert(tx.amount, tx.currency || 'VND', data.settings.displayCurrency);
}
function fmt(n) { return formatMoney(n, data.settings.displayCurrency); }
function fmtCur(n) { return fmt(n) + ' ' + data.settings.displayCurrency; }

function getCategories(type) {
  const base = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const customs = (data.customCategories?.[type] || []).map((nm, i) => ({
    id: `custom_${i}`, name: nm,
    color: type === 'income' ? '#a3e635' : '#f87171',
  }));
  const others = base.filter(c => c.id === 'other');
  const main = base.filter(c => c.id !== 'other');
  return [...main, ...customs, ...others];
}
function categoryByName(type, name) {
  return getCategories(type).find(c => c.name === name) || { name: name || 'Khác', color: '#9ca3af' };
}

// ---------- TAB SWITCHING ----------
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => jumpTab(btn.dataset.tab));
});
document.addEventListener('click', (e) => {
  const j = e.target.closest('[data-jump]');
  if (j) jumpTab(j.dataset.jump);
});
function jumpTab(name) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${name}`));
  renderAll();
}

// ---------- CURRENCY ----------
async function initCurrency() {
  const info = await loadRates();
  const all = getAllCurrencies();
  const sel = $('#display-currency');
  sel.innerHTML = all.map(c => `<option value="${c}" ${c === data.settings.displayCurrency ? 'selected' : ''}>${c}</option>`).join('');
  sel.addEventListener('change', () => {
    data.settings.displayCurrency = sel.value; persist(); renderAll();
  });
  const txSel = $('#tx-currency');
  txSel.innerHTML = all.map(c => `<option value="${c}">${c}</option>`).join('');
  txSel.value = data.settings.displayCurrency;
  const note = $('#rates-note');
  if (info.fallback) note.textContent = '⚠ Tỷ giá offline (fallback)';
  else if (info.fromCache) note.textContent = '✓ Tỷ giá đã cache';
  else note.textContent = '✓ Tỷ giá vừa cập nhật';
}

// ---------- TX MODAL ----------
$('#btn-add-income').addEventListener('click', () => openModal('income'));
$('#btn-add-expense').addEventListener('click', () => openModal('expense'));
$('#modal-close').addEventListener('click', closeModal);
$('#modal-cancel').addEventListener('click', closeModal);
$('#modal-mask').addEventListener('click', (e) => { if (e.target.id === 'modal-mask') closeModal(); });

function openModal(type, editing = null) {
  $('#tx-type').value = type;
  $('#modal-title').textContent = editing
    ? (type === 'income' ? 'Sửa khoản thu' : 'Sửa khoản chi')
    : (type === 'income' ? 'Thêm khoản thu' : 'Thêm khoản chi');
  const catSel = $('#tx-category');
  const cats = getCategories(type);
  catSel.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  const customLabel = $('#tx-custom-cat-label');
  const onCatChange = () => { customLabel.hidden = catSel.value !== 'Khác'; };
  catSel.onchange = onCatChange;
  const form = $('#form-tx'); form.reset();
  $('#tx-id').value = editing?.id || '';
  form.amount.value = editing?.amount ? Number(editing.amount).toLocaleString('en-US') : '';
  updateAmountWords();
  form.currency.value = editing?.currency || data.settings.displayCurrency;
  form.note.value = editing?.note || '';
  form.date.value = editing?.date || todayStr();
  form.name.value = editing?.name || '';
  if (editing?.category) catSel.value = editing.category;
  if (editing?.customCategory) form.customCategory.value = editing.customCategory;
  onCatChange();
  const comboRoot = $('#tx-name-combo');
  const defaults = type === 'income' ? DEFAULT_INCOME_NAMES : DEFAULT_EXPENSE_NAMES;
  nameCombobox = new Combobox(comboRoot, {
    defaults,
    getCustom: () => (data.customNames?.[type] || []),
    onAddCustom: (val) => {
      data.customNames[type] = data.customNames[type] || [];
      if (!data.customNames[type].includes(val)) data.customNames[type].push(val);
      persist(); nameCombobox.setValue(val);
    },
    onDeleteCustom: (val) => {
      data.customNames[type] = (data.customNames[type] || []).filter(n => n !== val);
      persist();
      showToast('Đã xoá gợi ý "' + val + '"');
    },
  });
  renderCustomCatManager(type);
  $('#custom-cat-manager').hidden = true;
  $('#modal-mask').hidden = false;
}
function closeModal() { $('#modal-mask').hidden = true; }

// định dạng ô số tiền với dấu phẩy + hiển thị chữ
function updateAmountWords() {
  const inp = $('#tx-amount');
  const wEl = $('#tx-amount-words');
  if (!inp || !wEl) return;
  const num = parseMoney(inp.value);
  const cur = $('#tx-currency')?.value || data.settings.displayCurrency;
  wEl.textContent = num > 0 ? `${numberToWords(num)} ${cur}` : '';
}
function attachThousandFormat(inp, onChange) {
  inp.addEventListener('input', () => {
    const caretFromEnd = inp.value.length - inp.selectionStart;
    const num = parseMoney(inp.value);
    // giữ phần thập phân đang gõ
    const raw = inp.value.replace(/,/g, '');
    const hasDot = raw.includes('.');
    if (hasDot) {
      const [int, dec] = raw.split('.');
      inp.value = (Number(int) || 0).toLocaleString('en-US') + '.' + dec.slice(0, 2);
    } else {
      inp.value = num ? num.toLocaleString('en-US') : '';
    }
    const newPos = Math.max(0, inp.value.length - caretFromEnd);
    try { inp.setSelectionRange(newPos, newPos); } catch {}
    if (onChange) onChange(num);
  });
}
(function initAmountInput() {
  const inp = $('#tx-amount');
  if (inp) attachThousandFormat(inp, updateAmountWords);
  $('#tx-currency')?.addEventListener('change', updateAmountWords);
})();

function renderCustomCatManager(type) {
  const list = data.customCategories?.[type] || [];
  const box = $('#custom-cat-manager');
  if (!list.length) {
    box.innerHTML = '<small style="color:var(--text-dim)">Chưa có danh mục tuỳ chỉnh nào</small>';
    return;
  }
  box.innerHTML = '<small style="color:var(--text-soft)">Danh mục tuỳ chỉnh:</small>' +
    list.map(n => `<span class="cat-chip">${escapeHtml(n)}<button type="button" class="cat-chip-del" data-cat="${escapeHtml(n)}" data-type="${type}">✕</button></span>`).join('');
}

$('#btn-manage-cats').addEventListener('click', () => {
  const box = $('#custom-cat-manager');
  const type = $('#tx-type').value;
  renderCustomCatManager(type);
  box.hidden = !box.hidden;
});
$('#custom-cat-manager').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-chip-del');
  if (!btn) return;
  const { cat, type } = btn.dataset;
  data.customCategories[type] = (data.customCategories[type] || []).filter(n => n !== cat);
  persist();
  // refresh category dropdown
  const catSel = $('#tx-category');
  const cats = getCategories(type);
  const cur = catSel.value;
  catSel.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  if (cats.find(c => c.name === cur)) catSel.value = cur;
  renderCustomCatManager(type);
  showToast('Đã xoá danh mục "' + cat + '"');
});

$('#form-tx').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const type = f.type.value;
  const id = $('#tx-id').value || uid();
  let category = f.category.value;
  if (category === 'Khác' && f.customCategory.value.trim()) {
    const custom = f.customCategory.value.trim();
    category = custom;
    data.customCategories[type] = data.customCategories[type] || [];
    if (!data.customCategories[type].includes(custom)) data.customCategories[type].push(custom);
  }
  const tx = {
    id, name: f.name.value.trim(), amount: parseMoney(f.amount.value),
    currency: f.currency.value, category,
    customCategory: f.customCategory.value.trim() || '',
    date: f.date.value, note: f.note.value.trim(),
  };
  const arr = type === 'income' ? data.incomes : data.expenses;
  const idx = arr.findIndex(x => x.id === id);
  if (idx >= 0) arr[idx] = tx; else arr.push(tx);
  logHistory(`${idx >= 0 ? 'Sửa' : 'Thêm'} khoản ${type === 'income' ? 'thu' : 'chi'} "${tx.name}" (${formatMoney(tx.amount, tx.currency)} ${tx.currency})`);
  const defaults = type === 'income' ? DEFAULT_INCOME_NAMES : DEFAULT_EXPENSE_NAMES;
  data.customNames[type] = data.customNames[type] || [];
  if (tx.name && !defaults.includes(tx.name) && !data.customNames[type].includes(tx.name)) {
    data.customNames[type].push(tx.name);
  }
  persist(); closeModal(); renderAll();
  showToast(idx >= 0 ? 'Đã cập nhật' : (type === 'income' ? 'Đã thêm khoản thu' : 'Đã thêm khoản chi'));
});

document.addEventListener('click', (e) => {
  const ed = e.target.closest('.btn-edit');
  if (ed) {
    const { id, type } = ed.dataset;
    const arr = type === 'income' ? data.incomes : data.expenses;
    const tx = arr.find(x => x.id === id);
    if (tx) openModal(type, tx);
    return;
  }
  const del = e.target.closest('.btn-delete');
  if (del) {
    const { id, type } = del.dataset;
    if (!confirm('Xoá giao dịch này?')) return;
    const victim = (type === 'income' ? data.incomes : data.expenses).find(x => x.id === id);
    if (type === 'income') data.incomes = data.incomes.filter(x => x.id !== id);
    else data.expenses = data.expenses.filter(x => x.id !== id);
    logHistory(`Xoá khoản ${type === 'income' ? 'thu' : 'chi'} "${victim?.name || id}"`);
    persist(); renderAll(); showToast('Đã xoá');
  }
});

// ---------- AGGREGATION ----------
function txsOfMonth(type, k) {
  const arr = type === 'income' ? data.incomes : data.expenses;
  return arr.filter(x => monthKey(x.date) === k);
}
function totalOfMonth(type, k) {
  return txsOfMonth(type, k).reduce((s, x) => s + txInDisplay(x), 0);
}
// tổng lũy kế đến tháng endK (bao gồm tháng đó)
function cumulativeTotal(type, endK) {
  const arr = type === 'income' ? data.incomes : data.expenses;
  const [ey, em] = endK.split('-').map(Number);
  const last = ey * 12 + em;
  return arr.reduce((s, x) => {
    const [y, m] = monthKey(x.date).split('-').map(Number);
    return (y * 12 + m <= last) ? s + txInDisplay(x) : s;
  }, 0);
}
function months12(endK) {
  const [y, m] = endK.split('-').map(Number);
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
function categoryBreakdown(type, k) {
  const txs = txsOfMonth(type, k);
  const map = new Map();
  txs.forEach(t => {
    const key = t.category || 'Khác';
    map.set(key, (map.get(key) || 0) + txInDisplay(t));
  });
  return [...map.entries()].map(([name, amount]) => ({
    name, amount, color: categoryByName(type, name).color,
  })).sort((a, b) => b.amount - a.amount);
}
// số dư tài sản tính đến tháng cuối (cộng dồn ròng)
function balanceUpTo(endK) {
  const [ey, em] = endK.split('-').map(Number);
  const last = ey * 12 + em;
  let total = 0;
  [...data.incomes, ...data.expenses].forEach(t => {
    const [y, m] = monthKey(t.date).split('-').map(Number);
    if (y * 12 + m <= last) {
      const sign = data.incomes.includes(t) ? 1 : -1;
      total += sign * txInDisplay(t);
    }
  });
  return total;
}

// ---------- DASHBOARD ----------
function renderDashboard() {
  const m = thisMonthKey();
  $('#dash-month-label').textContent = monthLabel(m);
  $('#dash-income').innerHTML = fmt(totalOfMonth('income', m)) + ` <small>${data.settings.displayCurrency}</small>`;
  $('#dash-expense').innerHTML = fmt(totalOfMonth('expense', m)) + ` <small>${data.settings.displayCurrency}</small>`;
  $('#dash-balance').innerHTML = fmt(balanceUpTo(m)) + ` <small>${data.settings.displayCurrency}</small>`;

  const months = months12(nav.dashEnd);
  $('#dash-range').textContent = `${monthLabel(months[0])} → ${monthLabel(months[11])}`;
  const incs = months.map(k => totalOfMonth('income', k));
  const exps = months.map(k => totalOfMonth('expense', k));
  drawChart('chart-variation', {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: 'Thu', data: incs, backgroundColor: '#b3ff4a', borderRadius: 6, barThickness: 14 },
        { label: 'Chi', data: exps, backgroundColor: '#b985ff', borderRadius: 6, barThickness: 14 },
      ],
    },
    options: chartOpts(),
  });

  $('#tbody-dash-variation').innerHTML = months.map((k, i) => {
    const net = incs[i] - exps[i];
    return `<tr>
      <td>${monthLabel(k)}</td>
      <td class="num tx-up">${fmt(incs[i])}</td>
      <td class="num tx-down">${fmt(exps[i])}</td>
      <td class="num" style="color:${net>=0?'var(--neon-blue)':'var(--danger)'};font-weight:700">${fmt(net)}</td>
    </tr>`;
  }).join('');
}

// ---------- INCOME / EXPENSE ----------
function renderTransactionTab(type) {
  const isIncome = type === 'income';
  const prefix = isIncome ? 'income' : 'expense';
  const curM = isIncome ? nav.income : nav.expense;

  $(`#${prefix}-month-pick`).textContent = monthLabel(curM);
  $(`#${prefix}-month-label`).textContent = monthLabel(curM);
  const total = totalOfMonth(type, curM);
  $(`#${prefix}-total`).innerHTML = fmt(total) + ` <small>${data.settings.displayCurrency}</small>`;
  // tổng lũy kế đến thời điểm hiện tại
  const cumTotal = cumulativeTotal(type, thisMonthKey());
  $(`#${prefix}-cumulative`).innerHTML = fmt(cumTotal) + ` <small>${data.settings.displayCurrency}</small>`;

  // donut
  const cats = categoryBreakdown(type, curM);
  const allCats = getCategories(type);
  const dedup = [];
  const seen = new Set();
  allCats.forEach(c => {
    if (seen.has(c.name)) return;
    seen.add(c.name);
    const f = cats.find(x => x.name === c.name);
    dedup.push({ name: c.name, color: c.color, amount: f ? f.amount : 0 });
  });
  const drawCats = dedup.some(c => c.amount > 0) ? dedup : [{ name: 'Chưa có dữ liệu', color: '#3a3f55', amount: 1 }];
  drawChart(`chart-${prefix}-donut`, {
    type: 'doughnut',
    data: {
      labels: drawCats.map(c => c.name),
      datasets: [{
        data: drawCats.map(c => c.amount),
        backgroundColor: drawCats.map(c => c.color),
        borderColor: '#0b1224', borderWidth: 3,
      }],
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => {
          if (total === 0) return 'Chưa có dữ liệu';
          return `${ctx.label}: ${fmt(ctx.parsed)} (${(ctx.parsed / total * 100).toFixed(1)}%)`;
        }}},
      },
    },
  });
  $(`#${prefix}-donut-pct`).textContent = total === 0 ? '0%' : '100%';

  $(`#${prefix}-cat-list`).innerHTML =
    `<div class="cat-unit">Đơn vị: ${data.settings.displayCurrency}</div>` +
    dedup.filter(c => c.amount > 0).map(c => {
      const pct = total ? (c.amount / total * 100) : 0;
      return `<div class="cat-row">
        <span class="cat-dot" style="background:${c.color}"></span>
        <span>${escapeHtml(c.name)}</span>
        <span class="cat-pct">${pct.toFixed(0)}%</span>
        <span class="cat-amt">${fmt(c.amount)}</span>
        <span class="cat-go">›</span>
      </div>`;
    }).join('');

  // 12 tháng
  const endK = isIncome ? nav.income12End : nav.expense12End;
  const months = months12(endK);
  const totals = months.map(k => totalOfMonth(type, k));
  $(`#${prefix}-12-range`).textContent = `${monthLabel(months[0])} → ${monthLabel(months[11])}`;
  const sum = totals.reduce((s, x) => s + x, 0);
  const avg = sum / 12;
  $(`#${prefix}-12-total`).textContent = fmt(sum);
  $(`#${prefix}-12-avg`).textContent = fmt(avg);
  const cur = totals[11], prev = totals[10];
  const momEl = $(`#${prefix}-mom`);
  if (prev <= 0 && cur <= 0) momEl.textContent = '—';
  else if (prev === 0) { momEl.textContent = 'mới'; momEl.className = 'stat-value-sm tx-up'; }
  else {
    const d = ((cur - prev) / prev) * 100;
    momEl.textContent = (d >= 0 ? '↑ ' : '↓ ') + Math.abs(d).toFixed(1) + '%';
    momEl.className = 'stat-value-sm ' + (d >= 0 ? 'tx-up' : 'tx-down');
  }

  const color = isIncome ? '#b3ff4a' : '#b985ff';
  drawChart(`chart-${prefix}-12m`, {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [{ data: totals, backgroundColor: color, borderRadius: 6, barThickness: 18 }],
    },
    options: chartOpts({ noLegend: true }),
  });

  $(`#tbody-${prefix}-12`).innerHTML = months.map((k, i) => {
    const t = totals[i];
    const p = i > 0 ? totals[i - 1] : 0;
    let dStr = '—', cls = '';
    if (p > 0) {
      const d = ((t - p) / p) * 100;
      dStr = (d >= 0 ? '↑' : '↓') + Math.abs(d).toFixed(1) + '%';
      cls = d >= 0 ? 'delta-up' : 'delta-down';
    }
    return `<tr><td>${monthLabel(k)}</td><td class="num">${fmt(t)}</td><td class="num ${cls}">${dStr}</td></tr>`;
  }).join('');

  renderTxTable(type);
}

function renderTxTable(type) {
  const arr = (type === 'income' ? data.incomes : data.expenses)
    .slice().sort((a, b) => b.date.localeCompare(a.date));
  const tbody = $(`#tbody-${type}`);
  if (!arr.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Chưa có giao dịch nào</td></tr>`;
    return;
  }
  tbody.innerHTML = arr.map(t => {
    const cat = categoryByName(type, t.category);
    const dispAmt = txInDisplay(t);
    const orig = (t.currency || 'VND') !== data.settings.displayCurrency
      ? `<small style="color:var(--text-dim)"> (${formatMoney(t.amount, t.currency)} ${t.currency})</small>` : '';
    return `<tr>
      <td>${dateLabel(t.date)}</td>
      <td>${escapeHtml(t.name)}</td>
      <td><span class="tag" style="background:${cat.color}22;color:${cat.color}">${escapeHtml(cat.name)}</span></td>
      <td class="num" style="color:${type === 'income' ? 'var(--neon-green)' : 'var(--neon-purple)'};font-weight:700">
        ${fmt(dispAmt)} ${data.settings.displayCurrency}${orig}
      </td>
      <td>${escapeHtml(t.note)}</td>
      <td>
        <button class="btn-edit" data-id="${t.id}" data-type="${type}">Sửa</button>
        <button class="btn-delete" data-id="${t.id}" data-type="${type}">Xoá</button>
      </td>
    </tr>`;
  }).join('');
}

// ---------- CASHFLOW ----------
function renderCashflow() {
  // 2 stat trên cùng
  const cur = data.settings.displayCurrency;
  const mk = nav.cashflowMonth;
  $('#cf-month-label').textContent = monthLabel(mk);
  $('#cf-month-pick').textContent = monthLabel(mk);
  const monthNet = totalOfMonth('income', mk) - totalOfMonth('expense', mk);
  $('#cf-month-net').innerHTML = fmt(monthNet) + ` <small>${cur}</small>`;
  $('#cf-asset-total').innerHTML = fmt(balanceUpTo(thisMonthKey())) + ` <small>${cur}</small>`;

  const months = months12(nav.cashflowEnd);
  $('#cashflow-range').textContent = `${monthLabel(months[0])} → ${monthLabel(months[11])}`;
  const incs = months.map(k => totalOfMonth('income', k));
  const exps = months.map(k => totalOfMonth('expense', k));
  const nets = incs.map((v, i) => v - exps[i]);
  const sum = nets.reduce((s, x) => s + x, 0);
  const avg = sum / 12;
  $('#cashflow-sum').textContent = fmt(sum);
  $('#cashflow-avg').textContent = fmt(avg);
  const curNet = nets[11], prevNet = nets[10];
  const momEl = $('#cashflow-mom');
  if (prevNet === 0 && curNet === 0) momEl.textContent = '—';
  else if (prevNet === 0) { momEl.textContent = 'mới'; momEl.className = 'stat-value-sm tx-up'; }
  else {
    const d = ((curNet - prevNet) / Math.abs(prevNet)) * 100;
    momEl.textContent = (d >= 0 ? '↑ ' : '↓ ') + Math.abs(d).toFixed(1) + '%';
    momEl.className = 'stat-value-sm ' + (d >= 0 ? 'tx-up' : 'tx-down');
  }
  // % thay đổi của dòng tiền ròng so với tháng trước
  const netPct = nets.map((v, i) => {
    if (i === 0) return null;
    const p = nets[i - 1];
    if (p === 0) return null;
    return ((v - p) / Math.abs(p)) * 100;
  });
  drawChart('chart-cashflow', {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: 'Thu', data: incs, backgroundColor: '#b3ff4a', borderRadius: 6 },
        { label: 'Chi', data: exps, backgroundColor: '#b985ff', borderRadius: 6 },
        { label: 'Ròng', type: 'line', data: nets, borderColor: '#6bb6ff', backgroundColor: '#6bb6ff', tension: 0.3, fill: false, pointRadius: 3 },
      ],
    },
    options: chartOpts(),
    plugins: [pctChangePlugin(netPct, 2)],
  });
  $('#tbody-cashflow').innerHTML = months.map((k, i) => `<tr>
    <td>${monthLabel(k)}</td>
    <td class="num tx-up">${fmt(incs[i])}</td>
    <td class="num tx-down">${fmt(exps[i])}</td>
    <td class="num" style="color:${nets[i]>=0?'var(--neon-blue)':'var(--danger)'};font-weight:700">${fmt(nets[i])}</td>
  </tr>`).join('');
}

// ---------- INVESTMENT (v3 - 19/5) ----------

// month data helpers
function emptyMonthData() {
  const alloc = {};
  ASSET_ALLOCATION.forEach(a => alloc[a.id] = { amount: 0, weight: 0 });
  return {
    totalInvest: 0,
    alloc,
    stocks: [],   // [{code, qty, buyPrice}] - buyPrice in display currency per share
    gold: {},     // { SJC:{qty,buyPrice}, 'PNJ-9999':..., XAU:... }
    usd: { qty: 0, buyPrice: 0 },
    confirmed: false,
    unlocked: false, // tạm thời mở khoá để sửa
  };
}
function getMonthData(k) {
  data.settings.investMonths = data.settings.investMonths || {};
  if (!data.settings.investMonths[k]) data.settings.investMonths[k] = emptyMonthData();
  const md = data.settings.investMonths[k];
  // backward fill
  if (!md.alloc) md.alloc = emptyMonthData().alloc;
  ASSET_ALLOCATION.forEach(a => { if (!md.alloc[a.id]) md.alloc[a.id] = { amount: 0, weight: 0 }; });
  if (!md.stocks) md.stocks = [];
  if (!md.gold) md.gold = {};
  if (!md.usd) md.usd = { qty: 0, buyPrice: 0 };
  return md;
}
function isMonthEditable(k) {
  const md = data.settings.investMonths?.[k];
  if (!md || !md.confirmed) return true;       // chưa confirm → editable
  if (k === thisMonthKey()) return true;       // tháng hiện tại → editable
  return md.unlocked === true;                 // confirmed quá khứ: cần unlock
}
function monthKeyLE(k, ref) {
  // k <= ref
  const [y1, m1] = k.split('-').map(Number);
  const [y2, m2] = ref.split('-').map(Number);
  return y1 * 12 + m1 <= y2 * 12 + m2;
}
function confirmedMonths(uptoK) {
  const all = data.settings.investMonths || {};
  return Object.keys(all).filter(k => all[k].confirmed && monthKeyLE(k, uptoK)).sort();
}
function cumulativeInvest(uptoK) {
  let total = 0;
  confirmedMonths(uptoK).forEach(k => { total += Number(data.settings.investMonths[k].totalInvest) || 0; });
  // Cộng tháng hiện tại nếu nó chưa confirm nhưng đang xem
  const cur = data.settings.investMonths?.[uptoK];
  if (cur && !cur.confirmed && uptoK !== thisMonthKey()) {
    // không tính
  }
  return total;
}
function cumulativeAlloc(catId, uptoK) {
  let amt = 0;
  confirmedMonths(uptoK).forEach(k => { amt += Number(data.settings.investMonths[k].alloc?.[catId]?.amount) || 0; });
  return amt;
}
function cumulativeStocks(uptoK) {
  const agg = new Map(); // code -> { qty, cost }
  confirmedMonths(uptoK).forEach(k => {
    (data.settings.investMonths[k].stocks || []).forEach(s => {
      if (!s.code) return;
      const ex = agg.get(s.code) || { qty: 0, cost: 0 };
      const qty = Number(s.qty) || 0;
      const price = Number(s.buyPrice) || 0;
      ex.qty += qty; ex.cost += qty * price;
      agg.set(s.code, ex);
    });
  });
  return agg;
}
function cumulativeGold(uptoK) {
  const agg = {};
  GOLD_TYPES.forEach(g => agg[g.id] = { qty: 0, cost: 0 });
  confirmedMonths(uptoK).forEach(k => {
    const g = data.settings.investMonths[k].gold || {};
    Object.keys(agg).forEach(id => {
      const v = g[id]; if (!v) return;
      agg[id].qty += Number(v.qty) || 0;
      agg[id].cost += (Number(v.qty) || 0) * (Number(v.buyPrice) || 0);
    });
  });
  return agg;
}
function cumulativeUsd(uptoK) {
  let qty = 0, cost = 0;
  confirmedMonths(uptoK).forEach(k => {
    const u = data.settings.investMonths[k].usd; if (!u) return;
    qty += Number(u.qty) || 0;
    cost += (Number(u.qty) || 0) * (Number(u.buyPrice) || 0);
  });
  return { qty, cost };
}

// Refs to update labels
function refreshAllocMonthLabels() {
  const lbl = monthLabel(nav.investMonth);
  $$('.alloc-month-label').forEach(el => el.textContent = lbl);
  const pick = $('#invest-month-pick'); if (pick) pick.textContent = lbl;
}

// format ô tiền (text) khi đang gõ — giữ caret, thêm dấu phẩy ngăn nghìn
function formatMoneyInputLive(inp) {
  const caretFromEnd = inp.value.length - inp.selectionStart;
  const raw = inp.value.replace(/,/g, '');
  if (raw === '' || raw === '.') return;
  let formatted;
  if (raw.includes('.')) {
    const [int, dec] = raw.split('.');
    formatted = (Number(int) || 0).toLocaleString('en-US') + '.' + dec.slice(0, 2);
  } else {
    const num = Number(raw);
    formatted = isNaN(num) ? inp.value : (num ? num.toLocaleString('en-US') : '');
  }
  inp.value = formatted;
  const pos = Math.max(0, inp.value.length - caretFromEnd);
  try { inp.setSelectionRange(pos, pos); } catch {}
}

function netCashflow() { return balanceUpTo(thisMonthKey()); }

// snapshot phân bổ danh mục
function getAlloc4() {
  data.settings.alloc4 = data.settings.alloc4 || {};
  ASSET_ALLOCATION.forEach(a => {
    if (!data.settings.alloc4[a.id]) data.settings.alloc4[a.id] = { amount: 0, touched: false };
  });
  return data.settings.alloc4;
}
function investedSumAmt() {
  const a4 = getAlloc4();
  return INVEST_IDS.reduce((s, id) => s + (Number(a4[id].amount) || 0), 0);
}
// giá 1 đơn vị vàng (lượng SJC) theo đồng tiền hiển thị — để biết có đủ mua không
function goldUnitPrice() {
  const cur = data.settings.displayCurrency;
  const px = marketGet('gold', 'SJC');
  return px ? convert(px, 'VND', cur) : Infinity;
}
// gợi ý phân bổ: mỗi khoản 10% tổng ròng; vàng=0 nếu không đủ mua, chia lại cho 3 khoản kia
function allocSuggestions(net) {
  const target = net * 0.10;
  const sugg = {};
  INVEST_IDS.forEach(id => sugg[id] = target);
  if (target < goldUnitPrice()) {
    sugg.gold = 0;
    const extra = target / (INVEST_IDS.length - 1);
    INVEST_IDS.forEach(id => { if (id !== 'gold') sugg[id] += extra; });
  }
  return sugg;
}

function renderInvestment() {
  refreshAllocMonthLabels();
  const cur = data.settings.displayCurrency;
  const net = Math.max(0, netCashflow());
  const invested = investedSumAmt();
  const cashLeft = Math.max(0, net - invested);
  $('#sim-total-asset').textContent = fmt(net) + ' ' + cur;
  $('#sim-allocated').textContent = fmt(invested) + ' ' + cur;
  $('#sim-cash-left').textContent = fmt(cashLeft) + ' ' + cur;

  renderAllocation();
  renderStockPicker();
  renderGoldUsd();
  renderGrowth();
  renderStockBoard();
  renderOverview();
}

// ---- Bảng danh mục đầu tư (snapshot, tiền mặt tự cân bằng) ----
function renderAllocation() {
  const cur = data.settings.displayCurrency;
  const net = Math.max(0, netCashflow());
  const a4 = getAlloc4();
  const invested = investedSumAmt();
  const cashAmt = Math.max(0, net - invested);
  const sugg = allocSuggestions(net);
  const touchedCount = INVEST_IDS.filter(id => a4[id].touched && (a4[id].amount || 0) > 0).length;

  const rowFor = (a) => {
    const expPct = (a.ratio * 100).toFixed(0) + '%';
    if (a.id === 'cash') {
      const pct = net > 0 ? (cashAmt / net * 100) : 0;
      return `<tr class="row-cash">
        <td><b>${a.name}</b><div class="input-words">${cashAmt > 0 ? numberToWords(cashAmt) : ''}</div></td>
        <td class="num"><span class="cash-readonly">${fmt(cashAmt)} ${cur}</span></td>
        <td class="num">${pct.toFixed(1)}%</td>
        <td class="num" style="color:var(--text-dim)">—</td>
        <td class="num" style="color:var(--text-soft)">${expPct}</td>
      </tr>`;
    }
    const amt = Number(a4[a.id].amount) || 0;
    const pct = net > 0 ? (amt / net * 100) : 0;
    // khoản cuối tự tính: nếu 3/4 khoản đã nhập và khoản này chưa
    const isLastAuto = (touchedCount >= INVEST_IDS.length - 1) && !(a4[a.id].touched && amt > 0);
    const sg = sugg[a.id] || 0;
    return `<tr>
      <td><b>${a.name}</b><div class="input-words">${amt > 0 ? numberToWords(amt) : ''}</div></td>
      <td class="num"><input type="text" inputmode="decimal" class="alloc-input money-in" data-aid="${a.id}" data-field="amount" value="${amt ? amt.toLocaleString('en-US') : ''}" placeholder="0" ${isLastAuto ? 'disabled title="Tự tính từ phần còn lại"' : ''} /></td>
      <td class="num"><input type="text" inputmode="decimal" class="alloc-input" data-aid="${a.id}" data-field="weight" value="${amt ? pct.toFixed(2) : ''}" placeholder="0" ${isLastAuto ? 'disabled' : ''} /></td>
      <td class="num alloc-sugg" data-aid="${a.id}">${fmt(sg)} <small>(${net > 0 ? (sg / net * 100).toFixed(0) : 0}%)</small></td>
      <td class="num" style="color:var(--text-soft)">${expPct}</td>
    </tr>`;
  };

  $('#tbody-allocation').innerHTML =
    ASSET_ALLOCATION.map(rowFor).join('') + `
    <tr class="row-total">
      <td><b>Tổng</b></td>
      <td class="num">${fmt(net)} ${cur}</td>
      <td class="num">100%</td>
      <td class="num">—</td>
      <td class="num" style="color:var(--text-soft)">100%</td>
    </tr>`;

  // cảnh báo phân bổ
  const warn = $('#alloc-warning');
  if (net <= 0) {
    warn.hidden = true;
  } else if (invested > net + 0.5) {
    warn.hidden = false;
    warn.className = 'alloc-warning err';
    warn.innerHTML = `⚠ Tổng giá trị đầu tư (${fmt(invested)} ${cur}) đã vượt quá dòng tiền ròng (${fmt(net)} ${cur}). Vui lòng giảm bớt.`;
  } else if (cashAmt > 0.5 && touchedCount < INVEST_IDS.length) {
    warn.hidden = false;
    warn.className = 'alloc-warning';
    warn.innerHTML = `Số tiền <b>${fmt(cashAmt)} ${cur}</b> chưa được phân bổ hết vào danh mục đầu tư. Gợi ý: ` +
      INVEST_IDS.filter(id => !(a4[id].touched && a4[id].amount > 0))
        .map(id => `${ASSET_ALLOCATION.find(a => a.id === id).name} ≈ ${fmt(sugg[id])} ${cur}`).join(' · ');
  } else {
    warn.hidden = true;
  }
}

// nhập số tiền/% cho 1 khoản đầu tư → tiền mặt tự giảm; chặn vượt dòng ròng
function setAllocAmount(aid, amount) {
  const net = Math.max(0, netCashflow());
  const a4 = getAlloc4();
  const otherInvested = INVEST_IDS.filter(id => id !== aid).reduce((s, id) => s + (Number(a4[id].amount) || 0), 0);
  let amt = Math.max(0, amount);
  if (otherInvested + amt > net) {
    amt = Math.max(0, net - otherInvested);
    showToast('Không thể vượt quá dòng tiền ròng — đã giới hạn lại');
  }
  a4[aid].amount = amt;
  a4[aid].touched = amt > 0;
  persist();
}
$('#tbody-allocation').addEventListener('change', (e) => {
  const inp = e.target.closest('.alloc-input'); if (!inp) return;
  const aid = inp.dataset.aid, field = inp.dataset.field;
  if (aid === 'cash') return;
  const net = Math.max(0, netCashflow());
  const val = parseMoney(inp.value);
  if (field === 'amount') setAllocAmount(aid, val);
  else setAllocAmount(aid, net * (val / 100));
  const nm = ASSET_ALLOCATION.find(a => a.id === aid)?.name || aid;
  logHistory(`Cập nhật phân bổ "${nm}" = ${fmt(getAlloc4()[aid].amount)} ${data.settings.displayCurrency}`);
  renderInvestment();
});
$('#tbody-allocation').addEventListener('input', (e) => {
  const inp = e.target.closest('.money-in'); if (!inp) return;
  formatMoneyInputLive(inp);
});

$('#btn-alloc-suggest').addEventListener('click', () => {
  const net = Math.max(0, netCashflow());
  const sugg = allocSuggestions(net);
  const a4 = getAlloc4();
  INVEST_IDS.forEach(id => { a4[id].amount = sugg[id]; a4[id].touched = sugg[id] > 0; });
  persist();
  showToast('Đã áp dụng phân bổ đề xuất');
  renderInvestment();
});
$('#btn-alloc-clear').addEventListener('click', () => {
  const a4 = getAlloc4();
  INVEST_IDS.forEach(id => { a4[id].amount = 0; a4[id].touched = false; });
  persist();
  showToast('Đã đặt lại — toàn bộ là tiền mặt');
  renderInvestment();
});

// ---------- Cổ phiếu (giá mua = giá hiện hành, cố định) ----------
function stockCurrentPrice(code) {
  // giá hiển thị/CP: bảng giá tính theo nghìn VND → quy đổi
  const px = marketGet('stock', code);
  return px ? convert(px * 1000, 'VND', data.settings.displayCurrency) : 0;
}
function renderStockPicker() {
  const cur = data.settings.displayCurrency;
  const k = nav.investMonth;
  const md = getMonthData(k);
  const editable = isMonthEditable(k);
  const view = nav.stockView;
  const net = Math.max(0, netCashflow());
  const tbody = $('#tbody-stock-picker');
  const tfoot = $('#tfoot-stock-picker');
  const wrapper = $('#table-stock-picker').parentElement.parentElement;
  wrapper.classList.toggle('cum-mode', view === 'cum');

  $('#btn-add-stock-row').style.display = (view === 'month' && editable) ? '' : 'none';
  $('#stock-confirm-bar').style.display = view === 'month' ? '' : 'none';

  const allocStock = Number(getAlloc4().stock.amount) || 0;
  $('#stock-budget-hint').textContent = view === 'month'
    ? `Ngân sách cổ phiếu (từ danh mục đầu tư): ${fmt(allocStock)} ${cur}. Tổng số tiền các mã không được vượt quá mức này.`
    : '';

  if (view === 'cum') {
    const agg = cumulativeStocks(thisMonthKey());
    const items = [...agg.entries()].filter(([, v]) => v.qty > 0);
    const totalVal = items.reduce((s, [c, v]) => s + (stockCurrentPrice(c) ? v.qty * stockCurrentPrice(c) : v.cost), 0);
    tbody.innerHTML = items.length ? items.map(([code, v]) => {
      const info = findStock(code);
      const valNow = stockCurrentPrice(code) ? v.qty * stockCurrentPrice(code) : v.cost;
      const avgPx = v.qty > 0 ? v.cost / v.qty : 0;
      const w = net > 0 ? (valNow / net * 100) : 0;
      return `<tr>
        <td><b>${code}</b></td>
        <td style="color:var(--text-soft);font-size:12px">${info ? escapeHtml(info.name) : '—'}</td>
        <td class="num">${fmt(avgPx)} ${cur}</td>
        <td class="num">${fmt(valNow)} ${cur}</td>
        <td class="num">${v.qty.toLocaleString('en-US')}</td>
        <td class="num">${w.toFixed(2)}%</td>
        <td></td>
      </tr>`;
    }).join('') : `<tr class="empty-row"><td colspan="7">Chưa có dữ liệu cổ phiếu nào</td></tr>`;
    tfoot.innerHTML = `<tr class="row-total"><td colspan="3"><b>Tổng</b></td><td class="num">${fmt(totalVal)} ${cur}</td><td></td><td class="num">${net > 0 ? (totalVal / net * 100).toFixed(2) : 0}%</td><td></td></tr>`;
    return;
  }

  const list = md.stocks;
  if (!list.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Chưa có mã nào. Bấm "+ Thêm mã" để chọn.</td></tr>`;
  } else {
    tbody.innerHTML = list.map((s, i) => {
      const info = s.code ? findStock(s.code) : null;
      const price = s.code ? stockCurrentPrice(s.code) : 0;
      const qty = Number(s.qty) || 0;
      const amt = qty * price;
      const w = net > 0 ? (amt / net * 100) : 0;
      return `<tr>
        <td>${s.code
          ? `<button class="stock-input-mã" data-slot="${i}" data-act="pick">${s.code}</button>`
          : `<button class="stock-pick-btn" data-slot="${i}" data-act="pick">+ Chọn mã</button>`}</td>
        <td style="color:var(--text-soft);font-size:12px">${info ? escapeHtml(info.name) : '—'}</td>
        <td class="num">${price ? fmt(price) + ' ' + cur : '—'}</td>
        <td class="num"><input type="text" inputmode="decimal" class="alloc-input money-in" data-slot="${i}" data-act="amount" value="${amt ? Math.round(amt).toLocaleString('en-US') : ''}" placeholder="0" ${editable ? '' : 'disabled'} /></td>
        <td class="num"><input type="text" inputmode="numeric" class="alloc-input" data-slot="${i}" data-act="qty" value="${qty ? qty.toLocaleString('en-US') : ''}" placeholder="0" ${editable ? '' : 'disabled'} /></td>
        <td class="num">${w.toFixed(2)}%</td>
        <td>${editable ? `<button class="stock-row-del" data-slot="${i}" title="Xoá">✕</button>` : ''}</td>
      </tr>`;
    }).join('');
  }
  const monthTotal = list.reduce((s, x) => s + ((Number(x.qty) || 0) * (x.code ? stockCurrentPrice(x.code) : 0)), 0);
  const over = monthTotal > allocStock + 0.5;
  tfoot.innerHTML = `<tr class="row-total">
    <td colspan="3"><b>Tổng</b></td>
    <td class="num" style="${over ? 'color:var(--danger)' : ''}">${fmt(monthTotal)} ${cur}</td>
    <td></td>
    <td class="num">${net > 0 ? (monthTotal / net * 100).toFixed(2) : 0}%</td>
    <td></td>
  </tr>` + (over ? `<tr><td colspan="7" style="color:var(--danger);font-size:12px">⚠ Vượt ngân sách cổ phiếu ${fmt(allocStock)} ${cur}</td></tr>` : '');

  const st = $('#stock-confirm-status');
  if (md.confirmed) { st.textContent = '✓ Đã xác nhận'; st.className = 'confirm-status ok'; }
  else { st.textContent = ''; st.className = 'confirm-status'; }
}

$('#stock-view-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-view]'); if (!t) return;
  nav.stockView = t.dataset.view;
  $$('#stock-view-tabs .mk-tab').forEach(b => b.classList.toggle('active', b === t));
  renderStockPicker();
});
$('#btn-add-stock-row').addEventListener('click', () => {
  const md = getMonthData(nav.investMonth);
  if (!isMonthEditable(nav.investMonth)) return;
  md.stocks.push({ code: '', qty: 0, buyPrice: 0 });
  persist();
  renderStockPicker();
});
$('#tbody-stock-picker').addEventListener('click', (e) => {
  if (nav.stockView !== 'month' || !isMonthEditable(nav.investMonth)) return;
  const pick = e.target.closest('[data-act="pick"]');
  if (pick) { nav.pickerSlot = +pick.dataset.slot; openStockModal(); return; }
  const del = e.target.closest('.stock-row-del');
  if (del) {
    const i = +del.dataset.slot;
    getMonthData(nav.investMonth).stocks.splice(i, 1);
    persist(); renderStockPicker();
  }
});
$('#tbody-stock-picker').addEventListener('input', (e) => {
  const inp = e.target.closest('.money-in'); if (inp) formatMoneyInputLive(inp);
});
$('#tbody-stock-picker').addEventListener('change', (e) => {
  if (nav.stockView !== 'month' || !isMonthEditable(nav.investMonth)) return;
  const inp = e.target.closest('[data-act]'); if (!inp) return;
  const act = inp.dataset.act;
  if (act === 'pick') return;
  const i = +inp.dataset.slot;
  const md = getMonthData(nav.investMonth);
  const slot = md.stocks[i]; if (!slot || !slot.code) return;
  const price = stockCurrentPrice(slot.code);
  slot.buyPrice = price;  // giá mua cố định = giá hiện hành
  if (act === 'amount') {
    const amt = parseMoney(inp.value);
    slot.qty = price > 0 ? Math.round(amt / price) : 0;
  } else if (act === 'qty') {
    slot.qty = Math.max(0, Math.round(parseMoney(inp.value)));
  }
  persist();
  renderStockPicker();
});
$('#btn-stock-confirm').addEventListener('click', () => {
  const md = getMonthData(nav.investMonth);
  md.confirmed = true; md.unlocked = false;
  persist();
  logHistory('Xác nhận danh mục cổ phiếu tháng ' + monthLabel(nav.investMonth));
  showToast('Đã xác nhận cổ phiếu tháng ' + monthLabel(nav.investMonth));
  renderInvestment();
});
$('#btn-stock-clear').addEventListener('click', () => {
  if (!confirm('Xoá danh sách cổ phiếu tháng ' + monthLabel(nav.investMonth) + '?')) return;
  getMonthData(nav.investMonth).stocks = [];
  persist();
  renderStockPicker();
});

function openStockModal() {
  $('#stock-modal-mask').hidden = false;
  $('#stock-search').value = '';
  renderStockModalList();
}
$('#stock-modal-close').addEventListener('click', () => $('#stock-modal-mask').hidden = true);
$('#stock-modal-mask').addEventListener('click', (e) => { if (e.target.id === 'stock-modal-mask') $('#stock-modal-mask').hidden = true; });
$('.stock-picker-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-spt]');
  if (!t) return;
  nav.pickerGroup = t.dataset.spt;
  $$('.stock-picker-tabs .mk-tab').forEach(b => b.classList.toggle('active', b === t));
  renderStockModalList();
});
$('#stock-search').addEventListener('input', renderStockModalList);

function renderStockModalList() {
  const list = stockGroup(nav.pickerGroup);
  const q = $('#stock-search').value.trim().toUpperCase();
  const md = getMonthData(nav.investMonth);
  const taken = new Set(md.stocks.map(s => s.code).filter(Boolean));
  const filtered = list.filter(s => !q || s.code.includes(q) || s.name.toUpperCase().includes(q));
  $('#stock-pick-list').innerHTML = filtered.map(s => `
    <li class="${taken.has(s.code) ? 'taken' : ''}" data-code="${s.code}">
      <span class="sym">${s.code}</span>
      <span>${escapeHtml(s.name)}</span>
      <span style="color:var(--neon-blue);font-weight:700">${(marketGet('stock', s.code) ?? 0).toFixed(2)}</span>
    </li>`).join('');
}
$('#stock-pick-list').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-code]');
  if (!li || li.classList.contains('taken')) return;
  const code = li.dataset.code;
  const md = getMonthData(nav.investMonth);
  const i = nav.pickerSlot;
  // Lấy giá hiện hành làm giá mua mặc định, quy đổi sang display currency
  const cur = data.settings.displayCurrency;
  const px = marketGet('stock', code);
  const defaultBuy = px ? convert(px * 1000, 'VND', cur) : 0;
  if (i >= 0 && i < md.stocks.length) {
    md.stocks[i].code = code;
    if (!md.stocks[i].buyPrice) md.stocks[i].buyPrice = defaultBuy;
  } else {
    md.stocks.push({ code, qty: 0, buyPrice: defaultBuy });
  }
  persist();
  $('#stock-modal-mask').hidden = true;
  renderStockPicker();
});

// Stock board (bảng 2)
function renderStockBoard() {
  const list = stockGroup(nav.marketGroup);
  const cur = data.settings.displayCurrency;
  $('#tbody-stock-board').innerHTML = list.map(s => {
    const ref = marketRef('stock', s.code);
    const px = marketGet('stock', s.code);
    if (!ref || !px) return '';
    const { ceil, floor } = calcCeilFloor(ref);
    const diff = px - ref;
    const pct = (diff / ref) * 100;
    let cls = 'tx-flat';
    if (Math.abs(px - ceil) < 0.01) cls = 'tx-ceil';
    else if (Math.abs(px - floor) < 0.01) cls = 'tx-floor';
    else if (diff > 0) cls = 'tx-up';
    else if (diff < 0) cls = 'tx-down';
    return `<tr>
      <td><b>${s.code}</b></td>
      <td class="num tx-ceil">${ceil.toFixed(2)}</td>
      <td class="num tx-floor">${floor.toFixed(2)}</td>
      <td class="num">${ref.toFixed(2)}</td>
      <td class="num ${cls}">${px.toFixed(2)}</td>
      <td class="num ${cls}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}</td>
      <td class="num ${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</td>
    </tr>`;
  }).join('');
}
$('#market-cat-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-mk]');
  if (!t) return;
  nav.marketGroup = t.dataset.mk;
  $$('#market-cat-tabs .mk-tab').forEach(b => b.classList.toggle('active', b === t));
  renderStockBoard();
});

// Gold + USD (theo tháng / lũy kế) — giá mua = giá hiện hành (khóa), số tiền trước KL
function goldUsdPrice(id) {
  const cur = data.settings.displayCurrency;
  if (id === 'usd') { const fx = marketGet('fx', 'USD/VND'); return fx ? convert(fx, 'VND', cur) : 0; }
  const g = GOLD_TYPES.find(x => x.id === id);
  const px = marketGet('gold', id);
  return px ? convert(px, g.unit.startsWith('VND') ? 'VND' : 'USD', cur) : 0;
}
function renderGoldUsd() {
  const cur = data.settings.displayCurrency;
  const k = nav.investMonth;
  const md = getMonthData(k);
  const editable = isMonthEditable(k);
  const view = nav.goldUsdView;
  const net = Math.max(0, netCashflow());
  const wrapper = $('#table-gold-usd').parentElement;
  wrapper.classList.toggle('cum-mode', view === 'cum');

  $('#gu-price-col-head').textContent = view === 'cum' ? 'Giá TB mua' : 'Giá mua (hiện hành)';
  $('#goldusd-confirm-bar').style.display = view === 'month' ? '' : 'none';

  const rows = [];
  if (view === 'month') {
    const mkRow = (id, label, unit) => {
      const v = (id === 'usd' ? md.usd : md.gold[id]) || { qty: 0, buyPrice: 0 };
      const price = goldUsdPrice(id);
      const qty = Number(v.qty) || 0;
      const amt = qty * price;
      const w = net > 0 ? (amt / net * 100) : 0;
      return `<tr>
        <td><b>${label}</b></td>
        <td class="num">${price ? fmt(price) + ' ' + cur : '—'}</td>
        <td class="num"><input type="text" inputmode="decimal" class="alloc-input money-in" data-gu="${id}" data-act="amount" value="${amt ? Math.round(amt).toLocaleString('en-US') : ''}" placeholder="0" ${editable ? '' : 'disabled'} /></td>
        <td class="num"><input type="text" inputmode="decimal" class="alloc-input" data-gu="${id}" data-act="qty" value="${qty ? qty.toLocaleString('en-US', { maximumFractionDigits: 4 }) : ''}" placeholder="0" ${editable ? '' : 'disabled'} /></td>
        <td style="color:var(--text-soft)">${unit}</td>
        <td class="num">${w.toFixed(2)}%</td>
      </tr>`;
    };
    GOLD_TYPES.forEach(g => rows.push(mkRow(g.id, g.label, g.unit)));
    rows.push(mkRow('usd', 'USD', 'VND / USD'));
  } else {
    const cumG = cumulativeGold(thisMonthKey());
    GOLD_TYPES.forEach(g => {
      const v = cumG[g.id];
      const valNow = goldUsdPrice(g.id) ? v.qty * goldUsdPrice(g.id) : v.cost;
      const avg = v.qty > 0 ? v.cost / v.qty : 0;
      const w = net > 0 ? (valNow / net * 100) : 0;
      rows.push(`<tr>
        <td><b>${g.label}</b></td>
        <td class="num">${fmt(avg)} ${cur}</td>
        <td class="num">${fmt(valNow)} ${cur}</td>
        <td class="num">${v.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
        <td style="color:var(--text-soft)">${g.unit}</td>
        <td class="num">${w.toFixed(2)}%</td>
      </tr>`);
    });
    const cumU = cumulativeUsd(thisMonthKey());
    const valU = goldUsdPrice('usd') ? cumU.qty * goldUsdPrice('usd') : cumU.cost;
    const avgU = cumU.qty > 0 ? cumU.cost / cumU.qty : 0;
    rows.push(`<tr>
      <td><b>USD</b></td>
      <td class="num">${fmt(avgU)} ${cur}</td>
      <td class="num">${fmt(valU)} ${cur}</td>
      <td class="num">${cumU.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
      <td style="color:var(--text-soft)">VND / USD</td>
      <td class="num">${net > 0 ? (valU / net * 100).toFixed(2) : 0}%</td>
    </tr>`);
  }
  $('#tbody-gold-usd').innerHTML = rows.join('');

  const s = $('#goldusd-confirm-status');
  if (md.confirmed) { s.textContent = '✓ Đã xác nhận'; s.className = 'confirm-status ok'; }
  else { s.textContent = ''; s.className = 'confirm-status'; }
}

$('#goldusd-view-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-view]'); if (!t) return;
  nav.goldUsdView = t.dataset.view;
  $$('#goldusd-view-tabs .mk-tab').forEach(b => b.classList.toggle('active', b === t));
  renderGoldUsd();
});
$('#tbody-gold-usd').addEventListener('input', (e) => {
  const inp = e.target.closest('.money-in'); if (inp) formatMoneyInputLive(inp);
});
$('#tbody-gold-usd').addEventListener('change', (e) => {
  if (nav.goldUsdView !== 'month' || !isMonthEditable(nav.investMonth)) return;
  const inp = e.target.closest('input[data-gu]'); if (!inp) return;
  const md = getMonthData(nav.investMonth);
  const id = inp.dataset.gu, act = inp.dataset.act;
  const price = goldUsdPrice(id);
  const target = id === 'usd' ? (md.usd = md.usd || { qty: 0, buyPrice: 0 }) : (md.gold[id] = md.gold[id] || { qty: 0, buyPrice: 0 });
  target.buyPrice = price; // giá mua cố định = giá hiện hành
  const val = parseMoney(inp.value);
  if (act === 'amount') target.qty = price > 0 ? +(val / price).toFixed(4) : 0;
  else target.qty = Math.max(0, val);
  persist();
  renderGoldUsd();
});
$('#btn-goldusd-confirm').addEventListener('click', () => {
  const md = getMonthData(nav.investMonth);
  md.confirmed = true; md.unlocked = false;
  persist();
  logHistory('Xác nhận danh mục vàng/USD tháng ' + monthLabel(nav.investMonth));
  showToast('Đã xác nhận vàng/USD tháng ' + monthLabel(nav.investMonth));
  renderInvestment();
});
$('#btn-goldusd-clear').addEventListener('click', () => {
  if (!confirm('Xoá dữ liệu vàng/USD tháng ' + monthLabel(nav.investMonth) + '?')) return;
  const md = getMonthData(nav.investMonth);
  md.gold = {}; md.usd = { qty: 0, buyPrice: 0 };
  persist();
  renderGoldUsd();
});

// ---------- Bảng kỳ vọng tăng trưởng ----------
// % tăng trưởng kỳ vọng/năm theo loại tài sản (user có thể chỉnh)
function growthRateFor(label, catKey) {
  const eg = data.settings.expectedGrowth || {};
  if (typeof eg[label] === 'number' && !isNaN(eg[label])) return eg[label];
  if (catKey && typeof eg[catKey] === 'number' && !isNaN(eg[catKey])) return eg[catKey];
  if (catKey === 'Tiết kiệm') return 6;
  if (catKey === 'Tiền mặt') return -3.5;
  if (catKey === 'Vàng') return 9;
  if (catKey === 'USD') return 3;
  return 12; // cổ phiếu mặc định
}

function renderGrowth() {
  const cur = data.settings.displayCurrency;
  const years = nav.growthYears;
  const upto = thisMonthKey();
  const a4 = getAlloc4();

  const items = [];
  // Cổ phiếu (mỗi mã đã mua) — % tăng trưởng nhóm "Chứng khoán"
  const cumS = cumulativeStocks(upto);
  [...cumS.entries()].forEach(([code, v]) => {
    if (v.qty <= 0) return;
    const valueNow = stockCurrentPrice(code) ? v.qty * stockCurrentPrice(code) : v.cost;
    items.push({ label: code, catKey: 'Chứng khoán', value: valueNow });
  });
  // Gửi tiết kiệm + Tiền mặt lấy từ phân bổ snapshot
  if ((Number(a4.savings.amount) || 0) > 0) items.push({ label: 'Tiết kiệm', catKey: 'Tiết kiệm', value: Number(a4.savings.amount) });
  const net = Math.max(0, netCashflow());
  const cashLeft = Math.max(0, net - investedSumAmt());
  if (cashLeft > 0) items.push({ label: 'Tiền mặt', catKey: 'Tiền mặt', value: cashLeft });
  // Vàng
  const cumG = cumulativeGold(upto);
  GOLD_TYPES.forEach(g => {
    if (cumG[g.id].qty <= 0) return;
    const valueNow = goldUsdPrice(g.id) ? cumG[g.id].qty * goldUsdPrice(g.id) : cumG[g.id].cost;
    items.push({ label: g.label, catKey: 'Vàng', value: valueNow });
  });
  const cumU = cumulativeUsd(upto);
  if (cumU.qty > 0) {
    const valueNow = goldUsdPrice('usd') ? cumU.qty * goldUsdPrice('usd') : cumU.cost;
    items.push({ label: 'USD', catKey: 'USD', value: valueNow });
  }

  const rows = items.map(it => {
    const g = growthRateFor(it.label, it.catKey);
    const expVal = it.value * Math.pow(1 + g / 100, years);
    return `<tr>
      <td>${escapeHtml(it.label)} <small style="color:var(--text-dim)">(${it.catKey})</small></td>
      <td class="num">${fmt(it.value)} ${cur}</td>
      <td class="num"><input type="number" class="alloc-input gr-input" data-gr-label="${escapeHtml(it.label)}" value="${g.toFixed(2)}" step="0.1" /> %</td>
      <td class="num" style="color:var(--neon-green);font-weight:700">${fmt(expVal)} ${cur}</td>
    </tr>`;
  }).join('');

  const totalVal = items.reduce((s, x) => s + x.value, 0);
  const totalExp = items.reduce((s, x) => {
    const g = growthRateFor(x.label, x.catKey);
    return s + x.value * Math.pow(1 + g / 100, years);
  }, 0);
  const weighted = totalVal > 0 ? items.reduce((s, x) => {
    const g = growthRateFor(x.label, x.catKey);
    return s + g * (x.value / totalVal);
  }, 0) : 0;

  $('#tbody-growth').innerHTML = items.length ? rows + `
    <tr class="row-total">
      <td><b>Tổng</b></td>
      <td class="num">${fmt(totalVal)} ${cur}</td>
      <td class="num">${weighted.toFixed(2)}%</td>
      <td class="num">${fmt(totalExp)} ${cur}</td>
    </tr>` : `<tr class="empty-row"><td colspan="4">Chưa có dữ liệu đầu tư nào. Hãy nhập và xác nhận ở các bảng phía trên.</td></tr>`;
  $('#growth-total-expected').textContent = fmt(totalExp) + ' ' + cur;
  $('#growth-avg-pct').textContent = weighted.toFixed(2) + '%';
}

$('#growth-years-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-yr]'); if (!t) return;
  nav.growthYears = Number(t.dataset.yr);
  $$('#growth-years-tabs .pd-tab').forEach(b => b.classList.toggle('active', b === t));
  renderGrowth();
});
$('#tbody-growth').addEventListener('change', (e) => {
  const inp = e.target.closest('[data-gr-label]'); if (!inp) return;
  const lbl = inp.dataset.grLabel;
  data.settings.expectedGrowth = data.settings.expectedGrowth || {};
  data.settings.expectedGrowth[lbl] = Number(inp.value) || 0;
  persist();
  renderGrowth();
});

// Overview (table 4)
const OVERVIEW_DEFS = {
  currency: () => Object.keys(MARKET.refCurrencies).map(k => ({
    kind: 'fx', key: k, label: k.replace('/', '/'),
  })),
  index: () => Object.keys(MARKET.refIndices).map(k => ({
    kind: 'index', key: k, label: k,
  })),
  gold: () => Object.keys(MARKET.refGold).map(k => ({
    kind: 'gold', key: k, label: 'Vàng ' + k,
  })),
  stock: () => {
    // Hợp các mã đã có trong các tháng (kể cả chưa confirm) + tháng đang xem
    const codes = new Set();
    Object.values(data.settings.investMonths || {}).forEach(m => {
      (m.stocks || []).forEach(s => { if (s.code) codes.add(s.code); });
    });
    return [...codes].map(c => ({ kind: 'stock', key: c, label: c }));
  },
};

function renderOverview() {
  const cat = nav.overviewCat;
  const items = (OVERVIEW_DEFS[cat] || (() => []))();
  if (!items.length) {
    $('#overview-list').innerHTML = '<li style="justify-content:center;color:var(--text-dim)">Chưa có dữ liệu</li>';
    drawChart('chart-overview', { type: 'line', data: { labels: [], datasets: [] }, options: chartOpts({ noLegend: true }) });
    return;
  }
  // chọn item đầu nếu chưa có
  if (!nav.overviewSelected || !items.find(x => x.key === nav.overviewSelected.key && x.kind === nav.overviewSelected.kind)) {
    nav.overviewSelected = items[0];
  }
  $('#overview-list').innerHTML = items.map(it => {
    const ref = marketRef(it.kind, it.key);
    const px = marketGet(it.kind, it.key);
    const diff = px - ref;
    const pct = (diff / ref) * 100;
    const cls = diff >= 0 ? 'tx-up' : 'tx-down';
    const active = (nav.overviewSelected.kind === it.kind && nav.overviewSelected.key === it.key) ? 'active' : '';
    return `<li class="${active}" data-kind="${it.kind}" data-key="${it.key}">
      <span class="sym">${escapeHtml(it.label)}</span>
      <span class="price">${px ? px.toLocaleString('vi-VN', { maximumFractionDigits: 4 }) : '—'}</span>
      <span class="chg ${cls}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}</span>
      <span class="pct ${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>
    </li>`;
  }).join('');

  // chart
  const sel = nav.overviewSelected;
  const hist = marketHistory(sel.kind, sel.key, nav.overviewPeriod);
  drawChart('chart-overview', {
    type: 'line',
    data: {
      labels: hist.map(p => {
        const d = new Date(p.t);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      }),
      datasets: [{
        label: sel.label, data: hist.map(p => p.v),
        borderColor: '#6bb6ff', backgroundColor: 'rgba(107,182,255,0.15)',
        fill: true, tension: 0.25, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: chartOpts({ noLegend: true }),
  });
}

$('#overview-cat-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-cat]');
  if (!t) return;
  nav.overviewCat = t.dataset.cat;
  nav.overviewSelected = null;
  $$('#overview-cat-tabs .mk-tab').forEach(b => b.classList.toggle('active', b === t));
  renderOverview();
});
$('#overview-period-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-pd]');
  if (!t) return;
  nav.overviewPeriod = t.dataset.pd;
  $$('#overview-period-tabs .pd-tab').forEach(b => b.classList.toggle('active', b === t));
  renderOverview();
});
$('#overview-list').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-key]');
  if (!li) return;
  nav.overviewSelected = { kind: li.dataset.kind, key: li.dataset.key };
  renderOverview();
});

// ---------- Period navigation ----------
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-nav]');
  if (!a) return;
  const target = a.dataset.nav, dir = Number(a.dataset.dir);
  const map = {
    'dash': 'dashEnd', 'cashflow': 'cashflowEnd',
    'income-12': 'income12End', 'expense-12': 'expense12End',
    'income-m': 'income', 'expense-m': 'expense',
    'cashflow-month': 'cashflowMonth',
    'invest-month': 'investMonth',
  };
  const key = map[target]; if (!key) return;
  nav[key] = shiftMonth(nav[key], dir);
  renderAll();
});

// ---------- CHARTS ----------
function chartOpts({ noLegend = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: !noLegend, position: 'top', labels: { color: '#8a92a8', font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#14182a',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: { ticks: { color: '#8a92a8', font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: { color: '#8a92a8', font: { size: 10 },
          callback: (v) => {
            if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B';
            if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(0) + 'M';
            if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'K';
            return v;
          },
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };
}
function drawChart(id, config) {
  if (charts[id]) charts[id].destroy();
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, config);
}

// Plugin vẽ nhãn % thay đổi phía trên các điểm của dataset chỉ định
function pctChangePlugin(pctArr, datasetIndex) {
  return {
    id: 'pctChange' + datasetIndex,
    afterDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = '700 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      meta.data.forEach((pt, i) => {
        const d = pctArr[i];
        if (d == null) return;
        const up = d >= 0;
        ctx.fillStyle = up ? '#b3ff4a' : '#ff6b81';
        const txt = (up ? '▲' : '▼') + Math.abs(d).toFixed(1) + '%';
        ctx.fillText(txt, pt.x, pt.y - 8);
      });
      ctx.restore();
    },
  };
}

// ---------- DATA TOOLS ----------
$('#btn-export').addEventListener('click', () => { exportJson(data); showToast('Đã xuất file JSON'); });
$('#file-import').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { data = await importJson(f); persist(); renderAll(); showToast('Nhập dữ liệu thành công'); }
  catch (err) { alert('Không đọc được file: ' + err.message); }
  finally { e.target.value = ''; }
});
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ dữ liệu?')) return;
  resetData(); data = loadData(); renderAll(); showToast('Đã xoá tất cả');
});

// ---------- ĐA TÀI KHOẢN / CỘNG TÁC ----------
function logHistory(action) {
  data.history = data.history || [];
  data.history.push({ user: getCurrentUser(), ts: Date.now(), action });
  if (data.history.length > 500) data.history = data.history.slice(-500);
  persist();
}
function renderAccountUI() {
  const sel = $('#account-select');
  const accs = listAccounts();
  const curId = currentAccountId();
  sel.innerHTML = accs.map(a => `<option value="${a.id}" ${a.id === curId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
  $('#current-user').value = getCurrentUser();
}
$('#account-select').addEventListener('change', (e) => {
  switchAccount(e.target.value);
  data = loadData();
  renderAccountUI();
  renderAll();
  showToast('Đã chuyển tài khoản: ' + (currentAccount()?.name || ''));
});
$('#btn-new-account').addEventListener('click', () => {
  const name = prompt('Tên tài khoản doanh nghiệp mới:', 'Doanh nghiệp ' + (listAccounts().length + 1));
  if (name === null) return;
  createAccount(name);
  data = loadData();
  renderAccountUI();
  renderAll();
  showToast('Đã tạo tài khoản mới');
});
$('#current-user').addEventListener('change', (e) => {
  setCurrentUser(e.target.value);
  showToast('Người dùng: ' + getCurrentUser());
});

// ---- Collab modal ----
function openCollab() {
  $('#collab-acc-name').textContent = currentAccount()?.name || '—';
  // filter options
  const users = [...new Set((data.history || []).map(h => h.user))];
  $('#history-filter').innerHTML = '<option value="">Tất cả người dùng</option>' +
    users.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
  renderHistory();
  renderComments();
  $('#collab-mask').hidden = false;
}
function renderHistory() {
  const filter = $('#history-filter').value;
  const list = (data.history || []).slice().reverse()
    .filter(h => !filter || h.user === filter);
  $('#history-list').innerHTML = list.length ? list.map(h => `
    <li>
      <div>${escapeHtml(h.action)}</div>
      <div class="h-meta"><span class="h-user">${escapeHtml(h.user)}</span> · ${new Date(h.ts).toLocaleString('vi-VN')}</div>
    </li>`).join('') : '<li class="empty-hint">Chưa có lịch sử chỉnh sửa</li>';
}
function renderComments() {
  const list = (data.comments || []).slice().reverse();
  $('#comment-list').innerHTML = list.length ? list.map(c => `
    <li>
      <div>${escapeHtml(c.text)}</div>
      <div class="c-meta"><span class="c-user">${escapeHtml(c.user)}</span> · ${new Date(c.ts).toLocaleString('vi-VN')}</div>
    </li>`).join('') : '<li class="empty-hint">Chưa có bình luận</li>';
}
$('#btn-collab').addEventListener('click', openCollab);
$('#collab-close').addEventListener('click', () => $('#collab-mask').hidden = true);
$('#collab-mask').addEventListener('click', (e) => { if (e.target.id === 'collab-mask') $('#collab-mask').hidden = true; });
$('#history-filter').addEventListener('change', renderHistory);
$('#btn-add-comment').addEventListener('click', () => {
  const inp = $('#comment-input');
  const txt = inp.value.trim();
  if (!txt) return;
  data.comments = data.comments || [];
  data.comments.push({ user: getCurrentUser(), ts: Date.now(), text: txt });
  persist();
  inp.value = '';
  renderComments();
});
$('#comment-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-add-comment').click(); });
$('#btn-rename-account').addEventListener('click', () => {
  const name = prompt('Đổi tên tài khoản:', currentAccount()?.name || '');
  if (name === null) return;
  renameAccount(currentAccountId(), name);
  renderAccountUI();
  $('#collab-acc-name').textContent = currentAccount()?.name || '—';
  showToast('Đã đổi tên tài khoản');
});
$('#btn-delete-account').addEventListener('click', () => {
  if (!confirm('Xoá tài khoản "' + (currentAccount()?.name || '') + '" và toàn bộ dữ liệu của nó?')) return;
  deleteAccount(currentAccountId());
  data = loadData();
  $('#collab-mask').hidden = true;
  renderAccountUI();
  renderAll();
  showToast('Đã xoá tài khoản');
});

// ---------- ADVICE / KHUYẾN NGHỊ ----------
function renderAdvice() {
  const cur = data.settings.displayCurrency;
  const now = thisMonthKey();
  const months = months12(now);
  const incs = months.map(k => totalOfMonth('income', k));
  const exps = months.map(k => totalOfMonth('expense', k));
  const nets = incs.map((v, i) => v - exps[i]);

  const totalInc = cumulativeTotal('income', now);
  const totalExp = cumulativeTotal('expense', now);
  const net = totalInc - totalExp;
  const margin = totalInc > 0 ? (net / totalInc * 100) : 0;
  // tỉ lệ chi/thu
  const expRatio = totalInc > 0 ? (totalExp / totalInc * 100) : 0;
  // số tháng dòng tiền âm trong 12 tháng
  const negMonths = nets.filter(v => v < 0).length;
  // xu hướng: so sánh nửa năm gần với nửa trước
  const firstHalf = nets.slice(0, 6).reduce((s, x) => s + x, 0);
  const lastHalf = nets.slice(6).reduce((s, x) => s + x, 0);
  const trendUp = lastHalf >= firstHalf;

  // đã đầu tư bao nhiêu
  const invested = investedSumAmt();
  const investRatio = net > 0 ? (invested / net * 100) : 0;

  // KPIs
  $('#advice-kpis').innerHTML = [
    { label: 'Tổng dòng tiền ròng', val: fmt(net) + ' ' + cur, cls: net >= 0 ? 'green' : 'purple' },
    { label: 'Biên lợi nhuận ròng', val: margin.toFixed(1) + '%', cls: margin >= 0 ? 'green' : 'purple' },
    { label: 'Tỷ lệ chi / thu', val: expRatio.toFixed(1) + '%', cls: expRatio <= 80 ? 'blue' : 'purple' },
    { label: 'Đã phân bổ đầu tư', val: investRatio.toFixed(1) + '%', cls: 'blue' },
  ].map(k => `<div class="advice-kpi"><span class="k-label">${k.label}</span><span class="k-val ${k.cls}">${k.val}</span></div>`).join('');

  // chart dòng tiền ròng 12T
  drawChart('chart-advice-flow', {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: 'Ròng', data: nets, backgroundColor: nets.map(v => v >= 0 ? '#b3ff4a' : '#ff6b81'), borderRadius: 5 },
      ],
    },
    options: chartOpts({ noLegend: true }),
  });
  // chart phân bổ tài sản
  const a4 = getAlloc4();
  const cashLeft = Math.max(0, net - invested);
  const allocItems = [
    { name: 'Tiền mặt', v: cashLeft, c: '#9ca3af' },
    { name: 'Chứng khoán', v: Number(a4.stock.amount) || 0, c: '#b3ff4a' },
    { name: 'Tiết kiệm', v: Number(a4.savings.amount) || 0, c: '#fb923c' },
    { name: 'Vàng', v: Number(a4.gold.amount) || 0, c: '#facc15' },
    { name: 'USD', v: Number(a4.usd.amount) || 0, c: '#6bb6ff' },
  ].filter(x => x.v > 0);
  drawChart('chart-advice-alloc', {
    type: 'doughnut',
    data: {
      labels: allocItems.length ? allocItems.map(x => x.name) : ['Chưa phân bổ'],
      datasets: [{
        data: allocItems.length ? allocItems.map(x => x.v) : [1],
        backgroundColor: allocItems.length ? allocItems.map(x => x.c) : ['#3a3f55'],
        borderColor: '#0b1224', borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { color: '#8a92a8', font: { size: 10 } } } },
    },
  });

  // nhận xét tự động
  const notes = [];
  if (net >= 0) notes.push(['good', `Dòng tiền ròng lũy kế đang <b>dương ${fmt(net)} ${cur}</b> — doanh nghiệp tích lũy được vốn.`]);
  else notes.push(['bad', `Dòng tiền ròng lũy kế đang <b>âm ${fmt(Math.abs(net))} ${cur}</b> — cần kiểm soát chi phí gấp.`]);
  if (margin >= 20) notes.push(['good', `Biên lợi nhuận ròng ${margin.toFixed(1)}% ở mức tốt (≥20%).`]);
  else if (margin >= 0) notes.push(['warn', `Biên lợi nhuận ròng ${margin.toFixed(1)}% còn mỏng — nên tối ưu giá vốn & chi phí vận hành.`]);
  else notes.push(['bad', `Biên lợi nhuận âm — chi đang vượt thu, rủi ro thanh khoản.`]);
  if (expRatio > 90) notes.push(['warn', `Chi phí chiếm ${expRatio.toFixed(0)}% doanh thu — tỷ trọng cao, cần rà soát.`]);
  if (negMonths > 0) notes.push([negMonths >= 4 ? 'bad' : 'warn', `Có ${negMonths}/12 tháng dòng tiền âm — cần lập quỹ dự phòng.`]);
  notes.push([trendUp ? 'good' : 'warn', `Xu hướng 6 tháng gần đây ${trendUp ? 'cải thiện' : 'đi xuống'} so với nửa năm trước.`]);
  if (invested === 0) notes.push(['warn', `Chưa phân bổ vốn nhàn rỗi vào kênh đầu tư nào — tiền mặt đang để không, mất giá theo lạm phát.`]);
  $('#advice-notes').innerHTML = notes.map(([c, t]) => `<li class="${c}">${t}</li>`).join('');

  // kiến nghị
  const reco = [];
  if (net > 0 && investRatio < 30) reco.push(`<b>Phân bổ vốn nhàn rỗi:</b> đang để ${investRatio.toFixed(0)}% vốn vào đầu tư. Cân nhắc nâng tỷ trọng đầu tư lên ~40% theo gợi ý (mỗi kênh ≈10%) để chống mất giá tiền mặt.`);
  if (margin < 15) reco.push(`<b>Cải thiện biên lợi nhuận:</b> đàm phán lại giá vốn nhà cung cấp, cắt giảm chi phí vận hành không thiết yếu, tăng giá bán/chuyển dịch sang sản phẩm biên cao.`);
  if (negMonths >= 2) reco.push(`<b>Quỹ dự phòng:</b> duy trì quỹ tiền mặt tối thiểu 3–6 tháng chi phí cố định để vượt giai đoạn dòng tiền âm.`);
  reco.push(`<b>Đa dạng hóa:</b> không tập trung quá 50% vào một loại tài sản. Kết hợp cổ phiếu (tăng trưởng), tiết kiệm (an toàn), vàng & USD (phòng thủ).`);
  reco.push(`<b>Kế hoạch tương lai:</b> đặt mục tiêu dòng tiền ròng quý tới, theo dõi biên lợi nhuận hàng tháng, tái đầu tư lợi nhuận theo tỷ trọng kỳ vọng đã thiết lập.`);
  reco.push(`<b>Quản trị rủi ro:</b> với khoản đầu tư cổ phiếu, đặt ngưỡng cắt lỗ; với vay nợ, giữ chi phí lãi vay dưới 30% lợi nhuận hoạt động.`);
  $('#advice-reco').innerHTML = reco.map(t => `<li>${t}</li>`).join('');
}

// ---------- MAIN ----------
function renderAll() {
  renderDashboard();
  renderTransactionTab('income');
  renderTransactionTab('expense');
  renderCashflow();
  renderInvestment();
  renderAdvice();
}

(async function init() {
  initMarket();
  renderAccountUI();
  await initCurrency();
  renderAll();
  // chỉ update bảng cổ phiếu / overview khi có tick mới, không re-render toàn bộ
  marketSubscribe(() => {
    if (!$('#tab-investment').classList.contains('active')) return;
    renderStockBoard();
    // Chỉ re-render overview/picker/goldusd nếu không có input đang focus
    // (tránh xoá ký tự người dùng đang gõ)
    const ae = document.activeElement;
    const inForm = ae && ae.tagName === 'INPUT' &&
      (ae.closest('#tbody-stock-picker') || ae.closest('#tbody-gold-usd') ||
       ae.closest('#tbody-allocation') || ae.closest('#sim-month-edit-row') ||
       ae.closest('#tbody-growth'));
    if (!inForm) {
      renderOverview();
      renderStockPicker();
      renderGoldUsd();
      renderGrowth();
    }
    $('#stock-live-tag').classList.add('live');
    $('#stock-live-tag').textContent = '● Live (mock)';
  });
})();
