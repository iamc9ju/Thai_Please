export const merchantSalesCopy = {
  subsidy: 'รัฐอุดหนุน',
  personalPaid: 'จ่ายเอง',
  all: 'ดูร้านค้าทั้งหมด',
  title: 'ยอดขายร้านค้าทั้งหมด',
  search: 'ค้นหาร้านค้า',
  sort: 'เรียงยอดขาย',
  descending: 'มากไปน้อย',
  ascending: 'น้อยไปมาก',
  close: 'ปิด',
  previous: 'ก่อนหน้า',
  next: 'ถัดไป',
  rank: 'อันดับ',
  name: 'ร้านค้า',
  orders: 'บิลสำเร็จ',
  sales: 'ยอดขาย',
  empty: 'ไม่พบร้านค้า',
  count: (shown: number, total: number) => `แสดง ${shown} จาก ${total} ร้าน`,
  page: (page: number, total: number) => `หน้า ${page} จาก ${total}`,
  days: (days: number) => `${days} วันล่าสุด`,
} as const;

export const MERCHANT_SALES_DISPLAY = { preview: 5, pageSize: 10 } as const;
