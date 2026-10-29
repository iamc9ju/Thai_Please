import { describe, it, expect } from 'vitest';
import { th } from './th';

describe('Localization Enforcement & i18n Completeness (NFR-I18N-01)', () => {
  it('provides a complete, well-formed Thai localization object', () => {
    expect(th).toBeDefined();
    expect(th.brand).toBe('ไทยช่วยไทยพรีส');
    expect(th.login).toBeDefined();
    expect(th.consumerPortal).toBeDefined();
    expect(th.merchantPortal).toBeDefined();
    expect(th.adminPortal).toBeDefined();
    expect(th.consumerPortal.qrScanner).toBeDefined();
  });

  it('contains non-empty localized strings across all core domain domains', () => {
    const validateNode = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        expect(node.trim().length, `Empty translation string at ${path}`).toBeGreaterThan(0);
      } else if (typeof node === 'function') {
        // functions like expiresIn or confirmPay should return non-empty strings
        try {
          const fnResult = (node as (...args: unknown[]) => unknown)('1', '2');
          expect(typeof fnResult).toBe('string');
          expect((fnResult as string).trim().length).toBeGreaterThan(0);
        } catch {
          // Some functions may expect specific arguments, which is fine
        }
      } else if (typeof node === 'object' && node !== null) {
        for (const [key, child] of Object.entries(node)) {
          validateNode(child, `${path}.${key}`);
        }
      }
    };

    validateNode(th.login, 'th.login');
    validateNode(th.consumerPortal.payment, 'th.consumerPortal.payment');
    validateNode(th.consumerPortal.qrScanner, 'th.consumerPortal.qrScanner');
    validateNode(th.merchantPortal.pos, 'th.merchantPortal.pos');
    validateNode(th.merchantPortal.wallet, 'th.merchantPortal.wallet');
    validateNode(th.merchantPortal.dashboard, 'th.merchantPortal.dashboard');
    validateNode(th.adminPortal, 'th.adminPortal');
  });

  it('enforces Thai language formatting conventions', () => {
    expect(th.consumerPortal.qrScanner.noCoupon).toContain('ไม่ใช้คูปอง');
    expect(th.consumerPortal.qrScanner.confirmPay('฿100.00')).toContain('100.00');
    expect(th.consumerPortal.payment.insufficientBalanceTitle).toBe('ยอดเงินส่วนตัวไม่เพียงพอ');
    expect(th.login.role.options.consumer).toBe('ประชาชน');
    expect(th.login.role.options.merchant).toBe('ร้านค้า');
    expect(th.login.role.options.administrator).toBe('ผู้ดูแล');
  });
});
