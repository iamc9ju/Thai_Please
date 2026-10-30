import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FaqPage } from './FaqPage';
import { th } from '../../../i18n/th';

afterEach(() => {
  cleanup();
});

describe('FaqPage', () => {
  it('renders breadcrumbs, title, category filter buttons, and FAQ items', () => {
    const onBackToHome = vi.fn();
    render(<FaqPage onBackToHome={onBackToHome} />);

    expect(
      screen.getAllByText(th.landing.faqPage.meta.breadcrumbCurrent).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.landing.faqPage.meta.title,
      }),
    ).toBeInTheDocument();

    const backBtns = screen.getAllByRole('button', {
      name: new RegExp(th.landing.faqPage.meta.backToHome),
    });
    fireEvent.click(backBtns[0]!);
    expect(onBackToHome).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('button', { name: th.landing.faqPage.categories.consumer })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: th.landing.faqPage.categories.merchant })).toBeInTheDocument();
  });

  it('toggles accordion items and supports expand/collapse all', () => {
    render(<FaqPage onBackToHome={vi.fn()} />);

    // Click collapse all
    fireEvent.click(screen.getByRole('button', { name: th.landing.faqPage.collapseAll }));

    // Target the first question button
    const firstFaq = th.landing.faqPage.faqs[0]!;
    const questionButton = screen.getByRole('button', { name: new RegExp(firstFaq.question) });
    expect(questionButton).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    fireEvent.click(questionButton);
    expect(questionButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(firstFaq.answer)).toBeInTheDocument();

    // Click expand all
    fireEvent.click(screen.getByRole('button', { name: th.landing.faqPage.expandAll }));
    expect(questionButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('filters questions by search query and category', () => {
    render(<FaqPage onBackToHome={vi.fn()} />);

    // Filter by category merchant
    fireEvent.click(screen.getByRole('button', { name: th.landing.faqPage.categories.merchant }));
    expect(screen.getByText(/ร้านค้าประเภทใดบ้างที่สามารถสมัครเข้าร่วมโครงการได้/)).toBeInTheDocument();

    // Search input filter
    const searchInput = screen.getByLabelText(th.landing.faqPage.search.label);
    fireEvent.change(searchInput, { target: { value: 'คำถามที่ไม่มีอยู่จริง_xyz' } });

    expect(screen.getByText(th.landing.faqPage.emptyTitle)).toBeInTheDocument();
  });
});
