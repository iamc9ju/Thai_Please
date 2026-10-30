import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectInfoAndEligibilityPage } from './ProjectInfoAndEligibilityPage';
import { LandingPage } from './LandingPage';
import { th } from '../../../i18n/th';

afterEach(() => {
  cleanup();
});

describe('ProjectInfoAndEligibilityPage', () => {
  const defaultProps = {
    onBackToHome: vi.fn(),
    onRegisterConsumer: vi.fn(),
    onRegisterMerchant: vi.fn(),
    onLoginConsumer: vi.fn(),
    onLoginMerchant: vi.fn(),
  };

  it('renders project info tab by default with metrics, objectives, and categories', () => {
    render(<ProjectInfoAndEligibilityPage {...defaultProps} initialTab="project-info" />);

    // Meta & Breadcrumbs
    expect(screen.getByText(th.projectInfoAndEligibility.meta.backToHome)).toBeInTheDocument();
    expect(screen.getByText(th.projectInfoAndEligibility.meta.breadcrumbCurrent)).toBeInTheDocument();

    // Tab buttons
    expect(screen.getByRole('tab', { name: th.projectInfoAndEligibility.tabs.projectInfo })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: th.projectInfoAndEligibility.tabs.howToJoin })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    // Project Info Content
    const tInfo = th.projectInfoAndEligibility.projectInfo;
    expect(screen.getByText(tInfo.badge)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: tInfo.title })).toBeInTheDocument();
    expect(screen.getByText(tInfo.subtitle)).toBeInTheDocument();

    // Policy Stats
    expect(screen.getByText(tInfo.stats.coPay.value)).toBeInTheDocument();
    expect(screen.getByText(tInfo.stats.dailyLimit.value)).toBeInTheDocument();
    expect(screen.getByText(tInfo.stats.period.value)).toBeInTheDocument();
    expect(screen.getByText(tInfo.stats.quests.value)).toBeInTheDocument();

    // Objectives
    expect(screen.getByText(tInfo.objectives.title)).toBeInTheDocument();
    for (const item of tInfo.objectives.items) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }

    // Principles
    expect(screen.getByText(tInfo.principles.title)).toBeInTheDocument();
    for (const item of tInfo.principles.items) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }

    // Categories
    expect(screen.getByText(tInfo.categories.eligibleTitle)).toBeInTheDocument();
    expect(screen.getByText(tInfo.categories.ineligibleTitle)).toBeInTheDocument();

    // FAQ Section
    expect(screen.getByText(th.projectInfoAndEligibility.faq.title)).toBeInTheDocument();
  });

  it('switches between Project Info and How to Join main tabs', () => {
    render(<ProjectInfoAndEligibilityPage {...defaultProps} initialTab="project-info" />);

    const howToJoinTab = screen.getByRole('tab', { name: th.projectInfoAndEligibility.tabs.howToJoin });
    fireEvent.click(howToJoinTab);

    expect(howToJoinTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: th.projectInfoAndEligibility.tabs.projectInfo })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    // Should now show How to Join content
    const tJoin = th.projectInfoAndEligibility.howToJoin;
    expect(screen.getByText(tJoin.consumer.title)).toBeInTheDocument();
  });

  it('renders Consumer How-to-Join details and handles Consumer CTA actions', () => {
    const onRegisterConsumer = vi.fn();
    const onLoginConsumer = vi.fn();

    render(
      <ProjectInfoAndEligibilityPage
        {...defaultProps}
        initialTab="how-to-join"
        initialRole="consumer"
        onRegisterConsumer={onRegisterConsumer}
        onLoginConsumer={onLoginConsumer}
      />,
    );

    const tConsumer = th.projectInfoAndEligibility.howToJoin.consumer;
    expect(screen.getByText(tConsumer.title)).toBeInTheDocument();
    expect(screen.getByText(tConsumer.eligibilityTitle)).toBeInTheDocument();
    expect(screen.getByText(tConsumer.preparationTitle)).toBeInTheDocument();
    expect(screen.getByText(tConsumer.stepsTitle)).toBeInTheDocument();

    // 4 Steps
    for (const step of tConsumer.steps) {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    }

    // CTA: Register Consumer
    const registerBtn = screen.getByRole('button', { name: tConsumer.ctaPrimary });
    fireEvent.click(registerBtn);
    expect(onRegisterConsumer).toHaveBeenCalledTimes(1);

    // CTA: Login Consumer
    const loginBtn = screen.getByRole('button', { name: tConsumer.ctaSecondary });
    fireEvent.click(loginBtn);
    expect(onLoginConsumer).toHaveBeenCalledTimes(1);
  });

  it('switches to Merchant How-to-Join and handles Merchant CTA actions', () => {
    const onRegisterMerchant = vi.fn();
    const onLoginMerchant = vi.fn();

    render(
      <ProjectInfoAndEligibilityPage
        {...defaultProps}
        initialTab="how-to-join"
        initialRole="consumer"
        onRegisterMerchant={onRegisterMerchant}
        onLoginMerchant={onLoginMerchant}
      />,
    );

    // Click Merchant role tab
    const merchantTab = screen.getByRole('tab', {
      name: th.projectInfoAndEligibility.howToJoin.roleTabs.merchant,
    });
    fireEvent.click(merchantTab);

    const tMerchant = th.projectInfoAndEligibility.howToJoin.merchant;
    expect(screen.getByText(tMerchant.title)).toBeInTheDocument();
    expect(screen.getByText(tMerchant.eligibilityTitle)).toBeInTheDocument();
    expect(screen.getByText(tMerchant.preparationTitle)).toBeInTheDocument();
    expect(screen.getByText(tMerchant.stepsTitle)).toBeInTheDocument();

    // 4 Steps
    for (const step of tMerchant.steps) {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    }

    // CTA: Register Merchant
    const registerBtn = screen.getByRole('button', { name: tMerchant.ctaPrimary });
    fireEvent.click(registerBtn);
    expect(onRegisterMerchant).toHaveBeenCalledTimes(1);

    // CTA: Login Merchant
    const loginBtn = screen.getByRole('button', { name: tMerchant.ctaSecondary });
    fireEvent.click(loginBtn);
    expect(onLoginMerchant).toHaveBeenCalledTimes(1);
  });

  it('expands and collapses FAQ accordions', () => {
    render(<ProjectInfoAndEligibilityPage {...defaultProps} initialTab="project-info" />);

    const faqItems = th.projectInfoAndEligibility.faq.items;
    const firstFaq = faqItems[0];
    if (!firstFaq) throw new Error('Expected at least one FAQ item');

    const firstQuestionBtn = screen.getByRole('button', { name: firstFaq.q });
    expect(firstQuestionBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(firstFaq.a)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(firstQuestionBtn);
    expect(firstQuestionBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(firstFaq.a)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(firstQuestionBtn);
    expect(firstQuestionBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(firstFaq.a)).not.toBeInTheDocument();
  });

  it('triggers onBackToHome when Back button is clicked', () => {
    const onBackToHome = vi.fn();
    render(<ProjectInfoAndEligibilityPage {...defaultProps} onBackToHome={onBackToHome} />);

    const backBtn = screen.getByRole('button', { name: th.projectInfoAndEligibility.meta.backToHome });
    fireEvent.click(backBtn);
    expect(onBackToHome).toHaveBeenCalledTimes(1);
  });
});

describe('LandingPage Navigation with Project Info and How to Join', () => {
  it('navigates from Landing Page home to Project Info and returns', () => {
    render(<LandingPage onLogin={vi.fn()} />);

    // Click Project Info link in nav
    const projectInfoLink = screen.getByText(th.landing.nav.projectInfo);
    fireEvent.click(projectInfoLink);

    // Should now show Project Info view
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.projectInfoAndEligibility.projectInfo.title,
      }),
    ).toBeInTheDocument();

    // Click Back to Home
    const backBtn = screen.getByRole('button', { name: th.projectInfoAndEligibility.meta.backToHome });
    fireEvent.click(backBtn);

    // Should return to hero banner
    expect(screen.getByAltText(th.landing.bannerAlt)).toBeInTheDocument();
  });

  it('navigates from schedule quick links to How to Join', () => {
    render(<LandingPage onLogin={vi.fn()} />);

    const howToJoinQuickBtn = screen.getByRole('button', {
      name: new RegExp(th.landing.schedule.viewHowToJoin, 'i'),
    });
    fireEvent.click(howToJoinQuickBtn);

    expect(
      screen.getByText(th.projectInfoAndEligibility.howToJoin.consumer.title),
    ).toBeInTheDocument();
  });
});
