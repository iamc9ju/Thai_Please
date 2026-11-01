import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrandLoadingScreen, BrandLogoAnimation } from './BrandLoadingScreen';
import { th } from '../i18n/th';

afterEach(cleanup);

describe('BrandLoadingScreen & BrandLogoAnimation', () => {
  it('renders BrandLogoAnimation with the Thai Please brand logo and accessible alt text', () => {
    render(<BrandLogoAnimation size="md" />);

    const logo = screen.getByRole('img', { name: th.brand });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/images/brand-logo.png');
  });

  it('renders BrandLoadingScreen with default status message and accessible role', () => {
    render(<BrandLoadingScreen />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(th.app.checkingSession)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: th.brand })).toBeInTheDocument();
  });

  it('renders custom label and sublabel when passed', () => {
    const customLabel = 'กำลังตรวจสอบการใช้งานระบบ...';
    const customSub = 'โปรดรอสักครู่ ระบบกำลังยืนยันตัวตน';

    render(
      <BrandLoadingScreen
        label={customLabel}
        sublabel={customSub}
        fullScreen={false}
      />,
    );

    expect(screen.getByText(customLabel)).toBeInTheDocument();
    expect(screen.getByText(customSub)).toBeInTheDocument();
  });
});
