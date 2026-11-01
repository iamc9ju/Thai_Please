export const merchantActionsCopy = {
  approveAll: 'อนุมัติทั้งหมด',
  searchLabel: 'ค้นหาร้านค้า',
  searchPlaceholder: 'ชื่อร้าน เจ้าของร้าน เบอร์โทร หรือที่อยู่',
  typeLabel: 'ประเภทร้านค้า',
  allTypes: 'ทุกประเภทร้านค้า',
  unknownType: 'ยังไม่ระบุประเภท',
  noMatches: 'ไม่พบร้านค้าที่ตรงกับการค้นหาหรือตัวกรอง',
  clearFilters: 'ล้างการค้นหาและประเภท',
  searchResult: (shown: number, total: number) =>
    `แสดง ${shown} จาก ${total} ร้าน`,
  confirmApprove: 'ยืนยันการอนุมัติร้านค้า',
  confirmReject: 'ยืนยันการปฏิเสธร้านค้า',
  confirmBulk: 'ยืนยันการอนุมัติทั้งหมด',
  approve: 'ยืนยันอนุมัติ',
  reject: 'ยืนยันปฏิเสธ',
  cancel: 'ยกเลิก',
  processing: 'กำลังดำเนินการ…',
  bulkHint:
    'อนุมัติเฉพาะร้านที่รออนุมัติและตรงกับการค้นหาหรือตัวกรองในรายการนี้ ร้านที่เข้ามาภายหลังจะไม่ถูกรวม',
  approveDescription:
    'ตรวจสอบชื่อร้านก่อนยืนยัน เมื่ออนุมัติแล้วร้านจะสามารถเริ่มใช้งานได้',
  rejectDescription:
    'ตรวจสอบชื่อร้านก่อนยืนยัน ร้านที่ถูกปฏิเสธจะยังไม่สามารถเริ่มใช้งานได้',
  failed: 'ไม่สามารถเปลี่ยนสถานะร้านค้าได้ กรุณาโหลดข้อมูลใหม่แล้วลองอีกครั้ง',
  refreshFailed: 'บันทึกผลแล้ว แต่โหลดรายการล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่',
  reasonLabel: 'หมายเหตุการตรวจสอบ',
  reasonPlaceholder: 'ระบุหมายเหตุการตรวจสอบ (บันทึกใน Audit Event)…',
  total: (count: number) =>
    `ร้านค้าที่รออนุมัติ ${count.toLocaleString('th-TH')} ร้าน`,
  progress: (done: number, total: number) =>
    `ดำเนินการแล้ว ${done} / ${total} ร้าน`,
  bulkResult: (success: number, failures: readonly string[]) =>
    `อนุมัติสำเร็จ ${success} ร้าน${failures.length ? ` · ไม่สำเร็จ ${failures.length} ร้าน: ${failures.join(', ')} กรุณาโหลดข้อมูลใหม่เพื่อตรวจสอบ` : ''}`,
  updated: (name: string) =>
    `อัปเดตสถานะร้าน "${name}" สำเร็จ (บันทึก Audit เรียบร้อย)`,
} as const;
