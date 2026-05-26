// storage.js - lưu trữ trên localStorage + import/export JSON
// Hỗ trợ NHIỀU tài khoản doanh nghiệp trên cùng thiết bị (mô phỏng như Google Docs)
const LEGACY_KEY = 'finplan_data_v2';
const ACCOUNTS_KEY = 'tcdn_accounts';        // [{id, name, createdAt}]
const CURRENT_ACCT_KEY = 'tcdn_current_account';
const CURRENT_USER_KEY = 'tcdn_current_user';
const DATA_PREFIX = 'tcdn_data_';            // tcdn_data_<accountId>

function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function listAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch { return []; }
}
function _saveAccounts(list) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }

function getCurrentUser() { return localStorage.getItem(CURRENT_USER_KEY) || 'Quản trị viên'; }
function setCurrentUser(name) { localStorage.setItem(CURRENT_USER_KEY, (name || '').trim() || 'Quản trị viên'); }

function currentAccountId() {
  let accs = listAccounts();
  // khởi tạo lần đầu + di trú dữ liệu cũ
  if (!accs.length) {
    const id = _uid();
    accs = [{ id, name: 'Doanh nghiệp của tôi', createdAt: Date.now() }];
    _saveAccounts(accs);
    localStorage.setItem(CURRENT_ACCT_KEY, id);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) localStorage.setItem(DATA_PREFIX + id, legacy);
  }
  let cur = localStorage.getItem(CURRENT_ACCT_KEY);
  if (!cur || !accs.find(a => a.id === cur)) {
    cur = accs[0].id;
    localStorage.setItem(CURRENT_ACCT_KEY, cur);
  }
  return cur;
}
function currentAccount() {
  const id = currentAccountId();
  return listAccounts().find(a => a.id === id);
}
function createAccount(name) {
  const accs = listAccounts();
  const id = _uid();
  accs.push({ id, name: (name || '').trim() || 'Doanh nghiệp mới', createdAt: Date.now() });
  _saveAccounts(accs);
  localStorage.setItem(CURRENT_ACCT_KEY, id);
  return id;
}
function switchAccount(id) {
  if (listAccounts().find(a => a.id === id)) localStorage.setItem(CURRENT_ACCT_KEY, id);
}
function renameAccount(id, name) {
  const accs = listAccounts();
  const a = accs.find(x => x.id === id);
  if (a) { a.name = (name || '').trim() || a.name; _saveAccounts(accs); }
}
function deleteAccount(id) {
  let accs = listAccounts().filter(a => a.id !== id);
  if (!accs.length) { const nid = _uid(); accs = [{ id: nid, name: 'Doanh nghiệp của tôi', createdAt: Date.now() }]; }
  _saveAccounts(accs);
  localStorage.removeItem(DATA_PREFIX + id);
  if (localStorage.getItem(CURRENT_ACCT_KEY) === id) localStorage.setItem(CURRENT_ACCT_KEY, accs[0].id);
}
function _dataKey() { return DATA_PREFIX + currentAccountId(); }

// Danh mục mặc định — Tài chính doanh nghiệp (TCDN)
const INCOME_CATEGORIES = [
  { id: 'sales',      name: 'Doanh thu bán hàng',        color: '#a3e635' },
  { id: 'services',   name: 'Doanh thu dịch vụ',         color: '#34d399' },
  { id: 'financial',  name: 'Doanh thu tài chính',       color: '#c084fc' },
  { id: 'liquidate',  name: 'Thanh lý / nhượng bán TS',  color: '#fb923c' },
  { id: 'subsidy',    name: 'Trợ cấp / hoàn thuế',       color: '#22d3ee' },
  { id: 'other',      name: 'Thu nhập khác',             color: '#9ca3af' },
];

const EXPENSE_CATEGORIES = [
  { id: 'cogs',          name: 'Giá vốn hàng bán',          color: '#f87171' },
  { id: 'payroll',       name: 'Lương & BHXH',              color: '#fb923c' },
  { id: 'rent',          name: 'Thuê mặt bằng / kho bãi',   color: '#facc15' },
  { id: 'utilities',     name: 'Tiện ích & vận hành',       color: '#5eead4' },
  { id: 'marketing',     name: 'Marketing & bán hàng',      color: '#60a5fa' },
  { id: 'finance',       name: 'Chi phí tài chính (lãi vay)',color: '#e879f9' },
  { id: 'tax',           name: 'Thuế & phí',                color: '#fcd34d' },
  { id: 'depreciation',  name: 'Khấu hao tài sản',          color: '#a78bfa' },
  { id: 'rnd',           name: 'Nghiên cứu & phát triển',   color: '#34d399' },
  { id: 'admin',         name: 'Chi phí quản lý DN',        color: '#f472b6' },
  { id: 'capex',         name: 'Mua sắm tài sản (CAPEX)',   color: '#22d3ee' },
  { id: 'logistics',     name: 'Vận chuyển & logistics',    color: '#fda4af' },
  { id: 'other',         name: 'Chi phí khác',              color: '#9ca3af' },
];

// Gợi ý tên khoản (combobox) — bối cảnh doanh nghiệp
const DEFAULT_INCOME_NAMES = [
  'Bán hàng B2B', 'Bán lẻ', 'Hợp đồng dịch vụ', 'Phí tư vấn',
  'Lãi tiền gửi', 'Cổ tức đầu tư', 'Cho thuê tài sản', 'Doanh thu online',
  'Thanh lý thiết bị', 'Hoàn thuế GTGT', 'Trợ cấp', 'Thu hồi công nợ',
];
const DEFAULT_EXPENSE_NAMES = [
  'Nhập nguyên vật liệu', 'Nhập hàng hóa', 'Lương nhân viên', 'BHXH-BHYT',
  'Thuê văn phòng', 'Tiền điện', 'Tiền nước', 'Internet & viễn thông',
  'Quảng cáo Facebook', 'Quảng cáo Google', 'Lãi vay ngân hàng', 'Thuế TNDN',
  'Thuế GTGT', 'Khấu hao máy móc', 'Phí vận chuyển', 'Văn phòng phẩm',
  'Mua máy móc thiết bị', 'Chi phí đào tạo', 'Phí phần mềm/SaaS',
];

const defaultData = {
  incomes: [],   // {id, name, amount, currency, category, customCategory, date, note}
  expenses: [],
  settings: {
    investRatio: 40,
    displayCurrency: 'VND',
    // Đầu tư theo tháng
    // investMonths: { 'YYYY-MM': { totalInvest, alloc:{stock,savings,cash,gold,usd:{amount,weight}}, stocks:[{code,qty,buyPrice}], gold:{SJC,PNJ,XAU:{qty,buyPrice}}, usd:{qty,buyPrice}, confirmed:bool } }
    investMonths: {},
    // % tăng trưởng kỳ vọng/năm (user override)
    expectedGrowth: { 'Chứng khoán': 12, 'Tiết kiệm': 6, 'Tiền mặt': -3.5, 'Vàng': 9, 'USD': 3 },
    growthYears: 5,
    // Phân bổ danh mục (snapshot) — số tiền theo đồng tiền hiển thị
    // alloc4: { cash, stock, savings, gold, usd } : { amount, touched }
    alloc4: {},
  },
  // Tên khoản người dùng tự thêm (lưu lại để tái sử dụng)
  customNames: { income: [], expense: [] },
  // Danh mục tự thêm khi chọn "Khác"
  customCategories: { income: [], expense: [] },
  // Cộng tác: nhật ký chỉnh sửa + bình luận
  history: [],   // {user, ts, action}
  comments: [],  // {user, ts, text}
};

function loadData() {
  try {
    const raw = localStorage.getItem(_dataKey());
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultData),
      ...parsed,
      settings: { ...defaultData.settings, ...(parsed.settings || {}) },
      customNames: { ...defaultData.customNames, ...(parsed.customNames || {}) },
      customCategories: { ...defaultData.customCategories, ...(parsed.customCategories || {}) },
      history: Array.isArray(parsed.history) ? parsed.history : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
    };
  } catch (e) {
    console.warn('Lỗi đọc localStorage, dùng default', e);
    return structuredClone(defaultData);
  }
}

function saveData(data) {
  localStorage.setItem(_dataKey(), JSON.stringify(data));
}

function resetData() {
  localStorage.removeItem(_dataKey());
}

function exportJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `group2-tcdn-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.incomes) || !Array.isArray(data.expenses)) {
          throw new Error('File không đúng định dạng GROUP2.TCDN');
        }
        resolve({
          ...structuredClone(defaultData),
          ...data,
          settings: { ...defaultData.settings, ...(data.settings || {}) },
        });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
