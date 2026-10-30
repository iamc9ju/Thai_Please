import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';
import { th } from '../../../i18n/th';

const mockGetPublicMerchants = vi.hoisted(() => vi.fn());

vi.mock('../landing.api', () => ({
  getPublicMerchants: mockGetPublicMerchants,
}));

beforeEach(() => {
  mockGetPublicMerchants.mockReset();
  mockGetPublicMerchants.mockImplementation(() => new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
});

describe('LandingPage', () => {
  it('renders campaign navbar, hero banner, schedule, and actions', () => {
    const onLogin = vi.fn();
    render(<LandingPage onLogin={onLogin} />);

    // Brand logo
    const brandLogo = screen.getByAltText(th.landing.brand);
    expect(brandLogo).toBeInTheDocument();
    expect(brandLogo).toHaveAttribute('src', '/images/brand-logo.png');

    // Navigation links
    expect(screen.getByText(th.landing.nav.home)).toBeInTheDocument();
    expect(screen.getByText(th.landing.nav.projectInfo)).toBeInTheDocument();
    expect(screen.getByText(th.landing.nav.eligibility)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: th.landing.nav.findShops }),
    ).toHaveAttribute('href', '#merchant-search-section');
    expect(screen.getByText(th.landing.nav.mofNews)).toBeInTheDocument();
    expect(screen.getByText(th.landing.nav.faq)).toBeInTheDocument();

    // Panoramic Hero Banner image
    const heroBanner = screen.getByAltText(th.landing.bannerAlt);
    expect(heroBanner).toBeInTheDocument();
    expect(heroBanner).toHaveAttribute('src', '/images/hero-banner.png');

    // Schedule section
    expect(screen.getByText(th.landing.schedule.title)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.landing.schedule.dates,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(th.landing.schedule.subtitle)).toBeInTheDocument();

    // Header Login button
    expect(
      screen.getByRole('button', { name: th.landing.nav.login }),
    ).toBeInTheDocument();

    // How It Works infographic
    const howItWorks = screen.getByAltText(th.landing.howItWorks.imageAlt);
    expect(howItWorks).toBeInTheDocument();
    expect(howItWorks).toHaveAttribute('src', '/images/how-it-works.png');

    // Floating Support button
    expect(
      screen.getByRole('button', { name: th.landing.support.buttonLabel }),
    ).toBeInTheDocument();
  });

  it('triggers onLogin when login button is clicked', () => {
    const onLogin = vi.fn();
    render(<LandingPage onLogin={onLogin} />);

    const loginButton = screen.getByRole('button', {
      name: th.landing.nav.login,
    });
    fireEvent.click(loginButton);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('opens and closes support modal from floating button', () => {
    render(<LandingPage onLogin={vi.fn()} />);

    const supportBtn = screen.getByRole('button', {
      name: th.landing.support.buttonLabel,
    });
    fireEvent.click(supportBtn);

    expect(screen.getByText(th.landing.support.modalTitle)).toBeInTheDocument();
    expect(screen.getByText(th.landing.support.phone)).toBeInTheDocument();

    const closeBtn = screen.getAllByRole('button', {
      name: th.landing.support.close,
    })[0];
    expect(closeBtn).toBeDefined();
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }

    expect(
      screen.queryByText(th.landing.support.modalTitle),
    ).not.toBeInTheDocument();
  });

  it('loads random recommendations and searches public merchants', async () => {
    mockGetPublicMerchants
      .mockResolvedValueOnce([
        {
          merchantId: '1',
          merchantName: 'ร้านแนะนำหนึ่ง',
          merchantTypes: ['อาหารและเครื่องดื่ม'],
          description: 'ร้านชุมชน',
          address: 'กรุงเทพมหานคร',
        },
      ])
      .mockResolvedValueOnce([
        {
          merchantId: '2',
          merchantName: 'ร้านน้ำสมุนไพร',
          merchantTypes: ['เครื่องดื่ม'],
          description: null,
          address: 'เชียงใหม่',
        },
      ]);

    render(<LandingPage onLogin={vi.fn()} />);

    expect(await screen.findByText('ร้านแนะนำหนึ่ง')).toBeInTheDocument();
    expect(mockGetPublicMerchants).toHaveBeenNthCalledWith(1, '');

    fireEvent.change(screen.getByLabelText('ค้นหาร้านค้า'), {
      target: { value: 'สมุนไพร' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));

    expect(await screen.findByText('ร้านน้ำสมุนไพร')).toBeInTheDocument();
    expect(mockGetPublicMerchants).toHaveBeenNthCalledWith(2, 'สมุนไพร');
    expect(screen.queryByText('ร้านแนะนำหนึ่ง')).not.toBeInTheDocument();
  });

  it('navigates to merchant search page, news page, and faq page from header', async () => {
    mockGetPublicMerchants.mockResolvedValue([]);
    render(<LandingPage onLogin={vi.fn()} />);

    // Click "ค้นหาร้านค้า" link in header
    const findShopsLinks = screen.getAllByRole('link', { name: th.landing.nav.findShops });
    fireEvent.click(findShopsLinks[0]!);
    expect(screen.getByText(th.landing.merchantSearchPage.meta.title)).toBeInTheDocument();

    // Click back to home
    const backHomeBtn = screen.getAllByRole('button', {
      name: new RegExp(th.landing.merchantSearchPage.meta.backToHome),
    })[0]!;
    fireEvent.click(backHomeBtn);
    expect(screen.getByText(th.landing.schedule.title)).toBeInTheDocument();

    // Click "ข่าวจากกระทรวงการคลัง" in header
    const newsBtns = screen.getAllByRole('button', { name: th.landing.nav.mofNews });
    fireEvent.click(newsBtns[0]!);
    expect(screen.getByText(th.landing.mofNewsPage.meta.title)).toBeInTheDocument();

    // Click "คำถามที่พบบ่อย" in header
    const faqBtns = screen.getAllByRole('button', { name: th.landing.nav.faq });
    fireEvent.click(faqBtns[0]!);
    expect(screen.getByText(th.landing.faqPage.meta.title)).toBeInTheDocument();
  });
});
