// market.js — sinh dữ liệu thị trường (mock real-time)
//
// GHI CHÚ VỀ DỮ LIỆU REAL-TIME:
// - VNStock là thư viện Python, không thể gọi trực tiếp từ trình duyệt.
// - Các endpoint public của SSI/DNSE/VPS thường bị chặn CORS, không gọi được từ static page.
// - exchangerate-api dùng cho USD ✓ (CORS-friendly) — đã tích hợp ở currency.js.
// - Giá vàng XAU: thử goldapi.io / metals.live (cần key) → fallback mock.
// - Để có dữ liệu thật cần backend proxy hoặc dùng iframe TradingView/VietStock embed.
//
// Module này tạo dữ liệu MOCK ổn định theo seed, có "tick" cập nhật mỗi 5s
// để mô phỏng cảm giác real-time.

'use strict';

const MARKET = {
  // Reference prices (giá tham chiếu) cho mỗi mã/loại
  refStocks: {},
  refIndices: { VN30: 2068.62, VN100: 1996.22, HNX30: 487.90 },
  refCurrencies: {
    'USD/VND': 26345, 'EUR/USD': 1.1681, 'GBP/USD': 1.3416,
    'USD/JPY': 158.18, 'AUD/USD': 0.7226, 'USD/CHF': 0.7832, 'GBP/JPY': 212.22,
  },
  refGold: { 'XAU': 4682.01, 'SJC': 122500000, 'PNJ-9999': 121700000 },
  ticks: {},   // current price
  history: {}, // sym -> [{t, v}, ...]
  listeners: [],
};

// Sinh giá tham chiếu cho stocks (theo VN30 reference điển hình)
const STOCK_REF_PRICES = {
  ACB: 22.8, BCM: 64.0, BID: 43.5, BVH: 51.2, CTG: 35.9,
  FPT: 73.9, GAS: 83.5, GVR: 36.2, HDB: 27.4, HPG: 28.6,
  MBB: 23.1, MSN: 78.4, MWG: 62.5, PLX: 41.0, POW: 12.4,
  SAB: 60.3, SHB: 11.8, SSB: 22.6, SSI: 35.2, STB: 32.5,
  TCB: 25.7, TPB: 17.9, VCB: 61.0, VHM: 157.0, VIB: 18.5,
  VIC: 95.6, VJC: 110.3, VNM: 60.1, VPB: 19.2, VRE: 24.8,
};

function _seedStockRefs() {
  STOCKS_HOSE.forEach(s => {
    MARKET.refStocks[s.code] = STOCK_REF_PRICES[s.code] ?? (10 + (s.code.charCodeAt(0) % 90));
  });
}

function _rand(seed) {
  // Mulberry32 PRNG
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function _now() { return Date.now(); }

function _initTicks() {
  Object.entries(MARKET.refStocks).forEach(([k, v]) => {
    const delta = (_rand(k.charCodeAt(0) * 7) - 0.5) * 0.04 * v;
    MARKET.ticks['stock:' + k] = +(v + delta).toFixed(2);
  });
  Object.entries(MARKET.refIndices).forEach(([k, v]) => {
    const delta = (_rand(k.charCodeAt(0) * 11) - 0.5) * 0.012 * v;
    MARKET.ticks['index:' + k] = +(v + delta).toFixed(2);
  });
  Object.entries(MARKET.refCurrencies).forEach(([k, v]) => {
    const delta = (_rand(k.charCodeAt(1) * 13) - 0.5) * 0.005 * v;
    MARKET.ticks['fx:' + k] = +(v + delta).toFixed(4);
  });
  Object.entries(MARKET.refGold).forEach(([k, v]) => {
    const delta = (_rand(k.charCodeAt(0) * 17) - 0.5) * 0.008 * v;
    MARKET.ticks['gold:' + k] = +(v + delta).toFixed(2);
  });
}

function _tickStep() {
  // Mỗi tick: thay đổi 0.05% – 0.5%
  Object.keys(MARKET.ticks).forEach(k => {
    const ref = (k.startsWith('stock:') && MARKET.refStocks[k.slice(6)])
      || (k.startsWith('index:') && MARKET.refIndices[k.slice(6)])
      || (k.startsWith('fx:') && MARKET.refCurrencies[k.slice(3)])
      || (k.startsWith('gold:') && MARKET.refGold[k.slice(5)])
      || MARKET.ticks[k];
    const cur = MARKET.ticks[k];
    const noise = (Math.random() - 0.5) * 0.003 * cur;
    const mean = (ref - cur) * 0.05; // pull lại gần ref
    let next = cur + noise + mean;
    next = +next.toFixed(k.startsWith('fx:') ? 4 : 2);
    MARKET.ticks[k] = next;
    MARKET.history[k] = MARKET.history[k] || [];
    MARKET.history[k].push({ t: _now(), v: next });
    if (MARKET.history[k].length > 240) MARKET.history[k].shift();
  });
  MARKET.listeners.forEach(fn => { try { fn(); } catch {} });
}

function _seedHistory(periodPoints = 60) {
  const now = _now();
  Object.keys(MARKET.ticks).forEach(k => {
    MARKET.history[k] = [];
    const cur = MARKET.ticks[k];
    let v = cur;
    for (let i = periodPoints - 1; i >= 0; i--) {
      const t = now - i * 60_000; // mỗi điểm cách 1 phút
      v = v * (1 + (Math.random() - 0.5) * 0.004);
      MARKET.history[k].push({ t, v: +v.toFixed(4) });
    }
    MARKET.history[k].push({ t: now, v: cur });
  });
}

function marketGet(kind, key) {
  return MARKET.ticks[`${kind}:${key}`];
}

function marketRef(kind, key) {
  if (kind === 'stock') return MARKET.refStocks[key];
  if (kind === 'index') return MARKET.refIndices[key];
  if (kind === 'fx') return MARKET.refCurrencies[key];
  if (kind === 'gold') return MARKET.refGold[key];
  return null;
}

function marketHistory(kind, key, period) {
  const arr = MARKET.history[`${kind}:${key}`] || [];
  // period: 1D, 1W, 1M, 6M, 1Y, 5Y, MAX
  // Vì là mock nên chỉ giảm/tăng số điểm cho khác biệt thị giác
  const factor = { '1D': 1, '1W': 1.5, '1M': 2, '6M': 3, '1Y': 4, '5Y': 6, 'MAX': 8 }[period] || 1;
  return arr.map((p, i) => ({
    t: p.t,
    v: +(p.v * (1 + Math.sin(i * 0.1) * 0.002 * factor)).toFixed(4),
  }));
}

function marketSubscribe(fn) {
  MARKET.listeners.push(fn);
  return () => { MARKET.listeners = MARKET.listeners.filter(f => f !== fn); };
}

// ---- Khởi tạo ----
function initMarket() {
  _seedStockRefs();
  _initTicks();
  _seedHistory(60);
  setInterval(_tickStep, 5000);
}

// Tính trần/sàn (HOSE: ±7%)
function calcCeilFloor(ref) {
  return {
    ceil: +(ref * 1.07).toFixed(2),
    floor: +(ref * 0.93).toFixed(2),
  };
}
