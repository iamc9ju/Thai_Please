import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QrPaymentModal } from './consumer/components/QrPaymentModal';
import { LoginPage } from './auth/pages/LoginPage';
import { th } from '../i18n/th';

vi.mock('./auth/use-auth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    user: null,
    isLoading: false,
    isAuthenticated: false,
    logout: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

// Relative luminance formula per WCAG 2.2
function hexToLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('WCAG 2.2 AA Accessibility Audit Suite (NFR-ACC-01)', () => {
  describe('Contrast & Color Tokens (WCAG 2.2 Level AA - SC 1.4.3)', () => {
    it('primary brand colors meet minimum 4.5:1 contrast against background', () => {
      // Primary blue #0056b3 against white #ffffff
      const primaryOnWhite = contrastRatio('#0056b3', '#ffffff');
      expect(primaryOnWhite).toBeGreaterThanOrEqual(4.5);

      // Dark slate text #0f172a against white #ffffff
      const darkTextOnWhite = contrastRatio('#0f172a', '#ffffff');
      expect(darkTextOnWhite).toBeGreaterThanOrEqual(7.0);

      // White text #ffffff against dark slate #0f172a (consumer/merchant dark theme)
      const whiteOnDark = contrastRatio('#ffffff', '#0f172a');
      expect(whiteOnDark).toBeGreaterThanOrEqual(7.0);

      // Status badge: green text #15803d against light green #f0fdf4
      const greenBadgeContrast = contrastRatio('#15803d', '#f0fdf4');
      expect(greenBadgeContrast).toBeGreaterThanOrEqual(4.5);
    });

    it('UI components and interactive control boundaries meet 3:1 ratio (SC 1.4.11)', () => {
      // Button focus ring / border #2563eb against white #ffffff
      const focusRingOnWhite = contrastRatio('#2563eb', '#ffffff');
      expect(focusRingOnWhite).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('Dialogs & Modal Accessibility (WCAG 2.2 Level AA - SC 4.1.2)', () => {
    it('QrPaymentModal has role="dialog", aria-modal="true", and an accessible close button', () => {
      render(
        <QrPaymentModal
          isOpen={true}
          onClose={() => {}}
          availableCoupons={[]}
          onSuccess={() => {}}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      // Close button has accessible label from localization key
      const closeBtn = screen.getByRole('button', { name: th.consumerPortal.qrScanner.closeWindow });
      expect(closeBtn).toBeInTheDocument();
      expect(closeBtn).toHaveAttribute('type', 'button');
    });
  });

  describe('Form Labels & Keyboard Navigation (WCAG 2.2 Level AA - SC 1.3.1, 2.1.1)', () => {
    it('LoginPage has labelled inputs and visible submit button', () => {
      render(<LoginPage />);

      // Form inputs must have accessible labels
      const citizenInput = screen.getByRole('textbox', { name: /เลขประจำตัวประชาชน/i });
      expect(citizenInput).toBeInTheDocument();
      expect(citizenInput).not.toHaveAttribute('tabIndex', '-1');

      // Submit button has accessible text
      const submitBtn = screen.getByRole('button', { name: new RegExp(th.login.submit, 'i') });
      expect(submitBtn).toBeInTheDocument();
      expect(submitBtn).toHaveAttribute('type', 'submit');
    });
  });
});
