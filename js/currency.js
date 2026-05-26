// currency.js - tỷ giá hối đoái (exchangerate-api.com)
const RATES_KEY = 'finplan_rates_v1';
const RATES_TTL = 24 * 60 * 60 * 1000; // 24h
const RATES_URL = 'https://v6.exchangerate-api.com/v6/6f5902bf5a30d77e83882190/latest/USD';

// Fallback nếu API hỏng / offline (số liệu tham khảo 2026, USD-base)
const FALLBACK_RATES = {
  USD: 1, VND: 25400, EUR: 0.92, GBP: 0.78, JPY: 152,
  SGD: 1.34, KRW: 1330, CNY: 7.2, THB: 35, AUD: 1.52,
  CAD: 1.36, HKD: 7.8, TWD: 31, MYR: 4.7, INR: 83,
  CHF: 0.88, NZD: 1.65, IDR: 15700, PHP: 56, RUB: 92,
};

const COMMON_CURRENCIES = ['VND', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'KRW', 'CNY', 'THB', 'AUD'];

let _rates = null;
let _allCodes = COMMON_CURRENCIES.slice();

async function loadRates() {
  // cache trước
  try {
    const cached = JSON.parse(localStorage.getItem(RATES_KEY) || 'null');
    if (cached && Date.now() - cached.ts < RATES_TTL && cached.rates) {
      _rates = cached.rates;
      _allCodes = Object.keys(_rates);
      return { rates: _rates, fromCache: true, ts: cached.ts };
    }
  } catch {}

  // fetch
  try {
    const res = await fetch(RATES_URL);
    const json = await res.json();
    if (json.result === 'success' && json.conversion_rates) {
      _rates = json.conversion_rates;
      _allCodes = Object.keys(_rates);
      localStorage.setItem(RATES_KEY, JSON.stringify({ ts: Date.now(), rates: _rates }));
      return { rates: _rates, fromCache: false, ts: Date.now() };
    }
    throw new Error('API trả về lỗi: ' + (json['error-type'] || 'unknown'));
  } catch (err) {
    console.warn('Không tải được tỷ giá, dùng fallback:', err);
    _rates = FALLBACK_RATES;
    _allCodes = Object.keys(_rates);
    return { rates: _rates, fromCache: false, ts: 0, fallback: true };
  }
}

function getRates() { return _rates || FALLBACK_RATES; }
function getAllCurrencies() { return _allCodes.slice().sort(); }

// Quy đổi từ currency X sang currency Y (qua USD-base)
function convert(amount, from, to) {
  if (from === to) return amount;
  const r = getRates();
  const usd = amount / (r[from] || 1);
  return usd * (r[to] || 1);
}

// Format kiểu en-US: phẩy ngăn cách phần nghìn, chấm cho thập phân (1,234,567.89)
function formatMoney(n, currency = 'VND') {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  const maxFrac = currency === 'VND' ? 0 : 2;
  const str = abs.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
  return (n < 0 ? '-' : '') + str;
}

// ===== Đọc số tiền bằng chữ (tiếng Việt) =====
const _DV = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function _readTriple(num, full) {
  // num: 0..999 ; full: có phải nhóm đứng trước không (để đọc "không trăm")
  let s = '';
  const tram = Math.floor(num / 100);
  const chuc = Math.floor((num % 100) / 10);
  const dv = num % 10;
  if (tram > 0 || full) {
    s += _DV[tram] + ' trăm';
    if (chuc === 0 && dv > 0) s += ' lẻ';
  }
  if (chuc > 0) {
    if (chuc === 1) s += ' mười';
    else s += ' ' + _DV[chuc] + ' mươi';
  }
  if (dv > 0) {
    if (chuc === 0) s += ' ' + _DV[dv];
    else if (dv === 1 && chuc > 1) s += ' mốt';
    else if (dv === 5 && chuc >= 1) s += ' lăm';
    else s += ' ' + _DV[dv];
  }
  return s.trim();
}
function numberToWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'không';
  const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  const groups = [];
  while (n > 0) { groups.unshift(n % 1000); n = Math.floor(n / 1000); }
  let out = '';
  const ng = groups.length;
  for (let i = 0; i < ng; i++) {
    const g = groups[i];
    const isLeading = (i === 0);
    if (g === 0) continue;
    out += _readTriple(g, !isLeading) + units[ng - 1 - i] + ' ';
  }
  out = out.trim().replace(/\s+/g, ' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// Parse chuỗi số có dấu phẩy ngăn cách → number (vd "1,234.5" → 1234.5)
function parseMoney(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  return Number(String(str).replace(/,/g, '').trim()) || 0;
}
