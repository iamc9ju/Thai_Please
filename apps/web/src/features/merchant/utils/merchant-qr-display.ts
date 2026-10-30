import type { CreateOrderResponse } from '../merchant.types';

const QR_TAB_TITLE = 'QR รับชำระเงิน | ไทยช่วยไทยพลีส';

export function openMerchantQrDisplayTab(): Window | null {
  const tab = window.open('', '_blank');
  if (!tab) return null;

  tab.opener = null;
  prepareDocument(tab.document);

  const loading = tab.document.createElement('div');
  loading.className = 'status-card';
  loading.textContent = 'กำลังสร้าง QR ชำระเงิน...';
  tab.document.body.append(loading);
  return tab;
}

export function renderMerchantQrDisplayTab(
  tab: Window,
  order: CreateOrderResponse,
  qrDataUrl: string,
): void {
  prepareDocument(tab.document);

  const card = tab.document.createElement('main');
  card.className = 'qr-card';

  const badge = tab.document.createElement('p');
  badge.className = 'badge';
  badge.textContent = `Order #${order.orderId} · รอลูกค้าสแกนชำระ`;

  const amount = tab.document.createElement('h1');
  amount.textContent = formatCurrency(order.finalAmount);

  const countdown = tab.document.createElement('p');
  countdown.className = 'countdown';

  const image = tab.document.createElement('img');
  image.src = qrDataUrl;
  image.alt = `QR Code สำหรับ Order #${order.orderId}`;

  const itemHeading = tab.document.createElement('h2');
  itemHeading.textContent = 'รายการสินค้า';

  const itemList = tab.document.createElement('div');
  itemList.className = 'item-list';
  for (const item of order.items) {
    const row = tab.document.createElement('div');
    row.className = 'item-row';

    const name = tab.document.createElement('span');
    name.textContent = `${item.productName} × ${item.quantity}`;

    const lineTotal = tab.document.createElement('strong');
    lineTotal.textContent = formatCurrency(item.lineTotal);

    row.append(name, lineTotal);
    itemList.append(row);
  }

  const note = tab.document.createElement('p');
  note.className = 'note';
  note.textContent =
    'เมื่อชำระสำเร็จ ร้านค้าสามารถตรวจสอบสถานะและใบเสร็จได้จากหน้าหลัก';

  card.append(badge, amount, countdown, image, itemHeading, itemList, note);
  tab.document.body.append(card);

  const updateCountdown = (): number => {
    if (tab.closed) return 0;
    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(order.qrExpiresAt).getTime() - Date.now()) / 1000),
    );
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = String(remainingSeconds % 60).padStart(2, '0');
    countdown.textContent =
      remainingSeconds > 0
        ? `QR หมดอายุใน ${minutes}:${seconds}`
        : 'QR Code หมดอายุแล้ว';
    countdown.classList.toggle('expired', remainingSeconds === 0);
    return remainingSeconds;
  };

  updateCountdown();
  const intervalId = tab.setInterval(() => {
    if (tab.closed) {
      tab.clearInterval(intervalId);
      return;
    }
    if (updateCountdown() === 0) {
      tab.clearInterval(intervalId);
    }
  }, 1000);
}

export function renderMerchantQrDisplayError(
  tab: Window,
  message: string,
): void {
  if (tab.closed) return;
  prepareDocument(tab.document);
  const error = tab.document.createElement('div');
  error.className = 'status-card error';
  error.textContent = message;
  tab.document.body.append(error);
}

function prepareDocument(document: Document): void {
  document.title = QR_TAB_TITLE;
  document.documentElement.lang = 'th';
  document.head.replaceChildren();
  document.body.replaceChildren();

  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1';

  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      color: #0f172a;
      background: linear-gradient(145deg, #eff6ff, #f8fafc 55%, #dbeafe);
      font-family: 'Anuphan', system-ui, -apple-system, 'Noto Sans Thai', 'Segoe UI', sans-serif;
    }
    .qr-card, .status-card {
      width: min(100%, 440px);
      padding: 28px;
      border: 1px solid #dbeafe;
      border-radius: 28px;
      background: #fff;
      box-shadow: 0 24px 70px rgba(0, 61, 130, .14);
      text-align: center;
    }
    .badge {
      display: inline-block;
      margin: 0;
      padding: 6px 12px;
      border-radius: 999px;
      color: #0056b3;
      background: #eff6ff;
      font-size: 13px;
      font-weight: 700;
    }
    h1 { margin: 14px 0 4px; color: #003d82; font-size: 36px; }
    h2 { margin: 22px 0 10px; text-align: left; font-size: 14px; }
    .countdown { margin: 0 0 18px; color: #047857; font-weight: 700; }
    .countdown.expired { color: #be123c; }
    img {
      width: min(100%, 280px);
      aspect-ratio: 1;
      padding: 12px;
      border: 2px solid #dbeafe;
      border-radius: 20px;
      background: #fff;
    }
    .item-list { padding: 12px; border-radius: 16px; background: #f8fafc; }
    .item-row { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; font-size: 13px; text-align: left; }
    .note { margin: 18px 0 0; color: #64748b; font-size: 12px; line-height: 1.6; }
    .error { color: #b91c1c; border-color: #fecaca; background: #fff1f2; font-weight: 700; }
  `;

  document.head.append(meta, style);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(value);
}
