import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateOrderResponse } from '../merchant.types';
import {
  openMerchantQrDisplayTab,
  renderMerchantQrDisplayError,
  renderMerchantQrDisplayTab,
} from './merchant-qr-display';

const order: CreateOrderResponse = {
  orderId: '501',
  status: 'PENDING',
  subtotal: 80,
  finalAmount: 80,
  qrToken: 'qr-token-501',
  qrExpiresAt: new Date(Date.now() + 600_000).toISOString(),
  items: [
    {
      productId: '10',
      productName: 'ข้าวกะเพราหมูสับ',
      unitPrice: 80,
      quantity: 1,
      lineTotal: 80,
    },
  ],
};

describe('merchant QR display tab', () => {
  let frame: HTMLIFrameElement | null = null;

  afterEach(() => {
    vi.restoreAllMocks();
    frame?.remove();
    frame = null;
  });

  function createChildWindow(): Window {
    frame = document.createElement('iframe');
    document.body.append(frame);
    const childWindow = frame.contentWindow;
    if (!childWindow) throw new Error('Test iframe did not create a window');
    return childWindow;
  }

  it('opens a new tab with a loading state', () => {
    const childWindow = createChildWindow();
    vi.spyOn(window, 'open').mockReturnValue(childWindow);

    const openedTab = openMerchantQrDisplayTab();

    expect(openedTab).toBe(childWindow);
    expect(childWindow.document.body).toHaveTextContent(
      'กำลังสร้าง QR ชำระเงิน...',
    );
  });

  it('renders order details and QR without injecting product HTML', () => {
    const childWindow = createChildWindow();
    const unsafeOrder = {
      ...order,
      items: [
        {
          productId: '10',
          productName: '<img src=x onerror=alert(1)>',
          unitPrice: 80,
          quantity: 1,
          lineTotal: 80,
        },
      ],
    };

    renderMerchantQrDisplayTab(
      childWindow,
      unsafeOrder,
      'data:image/png;base64,abc',
    );

    expect(childWindow.document.body).toHaveTextContent('Order #501');
    expect(childWindow.document.body).toHaveTextContent(
      '<img src=x onerror=alert(1)>',
    );
    expect(childWindow.document.querySelector('.item-list img')).toBeNull();
    expect(childWindow.document.querySelector('img')).toHaveAttribute(
      'src',
      'data:image/png;base64,abc',
    );
  });

  it('shows an error in the opened tab when order creation fails', () => {
    const childWindow = createChildWindow();

    renderMerchantQrDisplayError(childWindow, 'ไม่สามารถสร้าง Order ได้');

    expect(childWindow.document.body).toHaveTextContent(
      'ไม่สามารถสร้าง Order ได้',
    );
  });
});
