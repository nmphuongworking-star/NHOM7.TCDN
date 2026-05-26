// stocks-data.js — Danh sách mã cổ phiếu HOSE / VN30 / VN100 + tên doanh nghiệp
'use strict';

const STOCKS_VN30 = [
  { code: 'ACB', name: 'NH TMCP Á Châu' },
  { code: 'BCM', name: 'Becamex IDC' },
  { code: 'BID', name: 'NH TMCP Đầu tư & Phát triển VN' },
  { code: 'BVH', name: 'Tập đoàn Bảo Việt' },
  { code: 'CTG', name: 'NH TMCP Công Thương VN' },
  { code: 'FPT', name: 'CTCP FPT' },
  { code: 'GAS', name: 'Tổng Cty Khí VN' },
  { code: 'GVR', name: 'Tập đoàn CN Cao su VN' },
  { code: 'HDB', name: 'NH TMCP Phát triển TP.HCM' },
  { code: 'HPG', name: 'CTCP Tập đoàn Hòa Phát' },
  { code: 'MBB', name: 'NH TMCP Quân Đội' },
  { code: 'MSN', name: 'Tập đoàn Masan' },
  { code: 'MWG', name: 'CTCP Đầu tư Thế Giới Di Động' },
  { code: 'PLX', name: 'Tập đoàn Xăng dầu VN' },
  { code: 'POW', name: 'Tổng Cty Điện lực Dầu khí VN' },
  { code: 'SAB', name: 'Tổng Cty CP Bia–Rượu–NGK Sài Gòn' },
  { code: 'SHB', name: 'NH TMCP Sài Gòn – Hà Nội' },
  { code: 'SSB', name: 'NH TMCP Đông Nam Á' },
  { code: 'SSI', name: 'CTCK SSI' },
  { code: 'STB', name: 'NH TMCP Sài Gòn Thương Tín' },
  { code: 'TCB', name: 'NH TMCP Kỹ Thương VN' },
  { code: 'TPB', name: 'NH TMCP Tiên Phong' },
  { code: 'VCB', name: 'NH TMCP Ngoại Thương VN' },
  { code: 'VHM', name: 'CTCP Vinhomes' },
  { code: 'VIB', name: 'NH TMCP Quốc tế VN' },
  { code: 'VIC', name: 'Tập đoàn Vingroup' },
  { code: 'VJC', name: 'CTCP Hàng không VietJet' },
  { code: 'VNM', name: 'CTCP Sữa Việt Nam – Vinamilk' },
  { code: 'VPB', name: 'NH TMCP Việt Nam Thịnh Vượng' },
  { code: 'VRE', name: 'CTCP Vincom Retail' },
];

const STOCKS_VN100_EXTRA = [
  { code: 'BSI', name: 'CTCK BIDV' },
  { code: 'BSR', name: 'Lọc hóa dầu Bình Sơn' },
  { code: 'BWE', name: 'Nước & Môi trường Bình Dương' },
  { code: 'CII', name: 'Đầu tư Hạ tầng Kỹ thuật TP.HCM' },
  { code: 'CTR', name: 'Viettel Construction' },
  { code: 'DBC', name: 'Tập đoàn Dabaco' },
  { code: 'DCM', name: 'Phân bón Cà Mau' },
  { code: 'DGC', name: 'Hóa chất Đức Giang' },
  { code: 'DGW', name: 'Digiworld' },
  { code: 'DPM', name: 'Đạm Phú Mỹ' },
  { code: 'DXG', name: 'Đất Xanh Group' },
  { code: 'EIB', name: 'NH TMCP Xuất Nhập Khẩu VN' },
  { code: 'FRT', name: 'FPT Retail' },
  { code: 'GEX', name: 'Gelex' },
  { code: 'GMD', name: 'Gemadept' },
  { code: 'HAG', name: 'Hoàng Anh Gia Lai' },
  { code: 'HCM', name: 'CTCK HSC' },
  { code: 'HSG', name: 'Tập đoàn Hoa Sen' },
  { code: 'HVN', name: 'Tổng Cty Hàng không VN' },
  { code: 'IMP', name: 'Dược phẩm IMEXPHARM' },
  { code: 'KBC', name: 'Tổng Cty Đô thị Kinh Bắc' },
  { code: 'KDH', name: 'Đầu tư & KD Nhà Khang Điền' },
  { code: 'LPB', name: 'NH TMCP Lộc Phát VN' },
  { code: 'NLG', name: 'Đầu tư Nam Long' },
  { code: 'NT2', name: 'Điện lực Dầu khí Nhơn Trạch 2' },
  { code: 'NVL', name: 'Tập đoàn Đầu tư Địa ốc No Va' },
  { code: 'OCB', name: 'NH TMCP Phương Đông' },
  { code: 'PC1', name: 'PCC1' },
  { code: 'PDR', name: 'Phát Đạt Real Estate' },
  { code: 'PNJ', name: 'Vàng bạc đá quý Phú Nhuận' },
  { code: 'PVD', name: 'PV Drilling' },
  { code: 'PVT', name: 'Vận tải Dầu khí' },
  { code: 'REE', name: 'Cơ Điện Lạnh' },
  { code: 'SBT', name: 'Thành Thành Công – Biên Hòa' },
  { code: 'SCS', name: 'Saigon Cargo Service' },
  { code: 'SZC', name: 'Sonadezi Châu Đức' },
  { code: 'TCH', name: 'Hoàng Huy' },
  { code: 'TLG', name: 'Tập đoàn Thiên Long' },
  { code: 'VCG', name: 'Vinaconex' },
  { code: 'VCI', name: 'CTCK Vietcap' },
  { code: 'VGC', name: 'Viglacera' },
  { code: 'VHC', name: 'Vĩnh Hoàn' },
  { code: 'VIX', name: 'CTCK VIX' },
  { code: 'VND', name: 'CTCK VNDIRECT' },
  { code: 'VPI', name: 'Văn Phú Invest' },
];

const STOCKS_HOSE_EXTRA = [
  { code: 'AAA', name: 'An Phát Bioplastics' },
  { code: 'ANV', name: 'Nam Việt' },
  { code: 'APH', name: 'An Phát Holdings' },
  { code: 'CMG', name: 'CMC Corporation' },
  { code: 'CTD', name: 'Coteccons' },
  { code: 'DHC', name: 'Đông Hải Bến Tre' },
  { code: 'DIG', name: 'DIC Corp' },
  { code: 'DRC', name: 'Cao su Đà Nẵng' },
  { code: 'GIL', name: 'Gilimex' },
  { code: 'HAH', name: 'Hải An' },
  { code: 'HDC', name: 'Hodeco' },
  { code: 'HDG', name: 'Hà Đô Group' },
  { code: 'HHV', name: 'Đèo Cả' },
  { code: 'HT1', name: 'Xi măng Vicem Hà Tiên' },
  { code: 'IDI', name: 'Đầu tư & Phát triển ĐaQuốc gia' },
  { code: 'ITA', name: 'Tân Tạo' },
  { code: 'NKG', name: 'Thép Nam Kim' },
  { code: 'PAN', name: 'PAN Group' },
  { code: 'PHR', name: 'Phước Hòa Rubber' },
  { code: 'PVP', name: 'Vận tải Dầu khí Thái Bình Dương' },
  { code: 'SAM', name: 'SAM Holdings' },
  { code: 'TCM', name: 'Dệt May Thành Công' },
  { code: 'VOS', name: 'Vận tải biển VN' },
];

// HOSE = VN30 ∪ VN100extras ∪ HOSEextras; VN100 = VN30 ∪ VN100extras
const STOCKS_VN100 = [...STOCKS_VN30, ...STOCKS_VN100_EXTRA];
const STOCKS_HOSE = [...STOCKS_VN100, ...STOCKS_HOSE_EXTRA];

function stockGroup(group) {
  if (group === 'VN30') return STOCKS_VN30;
  if (group === 'VN100') return STOCKS_VN100;
  return STOCKS_HOSE;
}

function findStock(code) {
  return STOCKS_HOSE.find(s => s.code === code) || { code, name: code };
}
