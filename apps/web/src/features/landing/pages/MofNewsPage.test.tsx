import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MofNewsPage } from './MofNewsPage';
import { th } from '../../../i18n/th';

afterEach(() => {
  cleanup();
});

describe('MofNewsPage', () => {
  it('renders breadcrumbs, header with ministry badge, category tabs, and articles', () => {
    const onBackToHome = vi.fn();
    render(<MofNewsPage onBackToHome={onBackToHome} />);

    expect(screen.getByText(th.landing.mofNewsPage.meta.breadcrumbCurrent)).toBeInTheDocument();
    expect(screen.getByText(th.landing.mofNewsPage.ministryBadge)).toBeInTheDocument();
    expect(screen.getByText(th.landing.mofNewsPage.meta.title)).toBeInTheDocument();

    // Check first article
    const firstArticle = th.landing.mofNewsPage.articles[0]!;
    expect(screen.getAllByText(firstArticle.title).length).toBeGreaterThan(0);

    // Back to home button
    const backBtn = screen.getByRole('button', {
      name: new RegExp(th.landing.mofNewsPage.meta.backToHome),
    });
    fireEvent.click(backBtn);
    expect(onBackToHome).toHaveBeenCalledTimes(1);
  });

  it('filters articles by search input and opens/closes detail modal', () => {
    render(<MofNewsPage onBackToHome={vi.fn()} />);

    const searchInput = screen.getByLabelText(th.landing.mofNewsPage.search.label);
    fireEvent.change(searchInput, { target: { value: 'POS' } });

    // Article with POS should appear, others should not
    expect(screen.getByText(/แนวทางปฏิบัติและเงื่อนไขการรับชำระเงินผ่านระบบ POS/)).toBeInTheDocument();

    // Click read full article button
    const readButtons = screen.getAllByRole('button', {
      name: new RegExp(th.landing.mofNewsPage.readFullArticle),
    });
    fireEvent.click(readButtons[0]!);

    // Dialog should be in document
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Close dialog
    const closeBtns = screen.getAllByRole('button', {
      name: th.landing.mofNewsPage.closeModal,
    });
    fireEvent.click(closeBtns[0]!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays empty state when search finds no results', () => {
    render(<MofNewsPage onBackToHome={vi.fn()} />);

    const searchInput = screen.getByLabelText(th.landing.mofNewsPage.search.label);
    fireEvent.change(searchInput, { target: { value: 'คำที่ไม่พบแน่นอน12345678' } });

    expect(screen.getByText(th.landing.mofNewsPage.emptyTitle)).toBeInTheDocument();
  });
});
