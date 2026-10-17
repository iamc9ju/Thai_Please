import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';
import { th } from '../../../i18n/th';

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
    expect(screen.getByText(th.landing.nav.findShops)).toBeInTheDocument();
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
});
