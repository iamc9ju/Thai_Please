import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantSearchPage } from './MerchantSearchPage';
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

describe('MerchantSearchPage', () => {
  it('renders breadcrumbs, search box, category filters, and calls onBackToHome', () => {
    const onBackToHome = vi.fn();
    render(<MerchantSearchPage onBackToHome={onBackToHome} />);

    expect(screen.getByRole('heading', { level: 1, name: th.landing.merchantSearchPage.meta.title })).toBeInTheDocument();

    const backButtons = screen.getAllByRole('button', {
      name: new RegExp(th.landing.merchantSearchPage.meta.backToHome),
    });
    expect(backButtons.length).toBeGreaterThan(0);
    fireEvent.click(backButtons[0]!);
    expect(onBackToHome).toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole('button', {
        name: th.landing.merchantSearchPage.filters.food,
      }),
    ).toBeInTheDocument();
  });

  it('loads merchants, renders them, and filters by category and search keyword', async () => {
    mockGetPublicMerchants.mockResolvedValueOnce([
      {
        merchantId: 'm1',
        merchantName: 'ก๋วยเตี๋ยวเรืออยุธยา',
        merchantTypes: ['อาหารและเครื่องดื่ม'],
        description: 'ก๋วยเตี๋ยวน้ำตกสูตรโบราณ',
        address: 'ตลาดน้ำคลองลัดมะยม',
      },
      {
        merchantId: 'm2',
        merchantName: 'ผ้าไหมมัดหมี่ OTOP',
        merchantTypes: ['ร้าน OTOP'],
        description: 'ผ้าทอมือคุณภาพส่งออก',
        address: 'ขอนแก่น',
      },
    ]);

    render(<MerchantSearchPage onBackToHome={vi.fn()} />);

    expect(await screen.findByText('ก๋วยเตี๋ยวเรืออยุธยา')).toBeInTheDocument();
    expect(screen.getByText('ผ้าไหมมัดหมี่ OTOP')).toBeInTheDocument();

    // Filter by food category
    fireEvent.click(
      screen.getByRole('button', {
        name: th.landing.merchantSearchPage.filters.food,
      }),
    );
    expect(screen.getByText('ก๋วยเตี๋ยวเรืออยุธยา')).toBeInTheDocument();
    expect(screen.queryByText('ผ้าไหมมัดหมี่ OTOP')).not.toBeInTheDocument();

    // Reset to all
    fireEvent.click(screen.getByRole('button', { name: th.landing.merchantSearchPage.filters.all }));
    expect(screen.getByText('ผ้าไหมมัดหมี่ OTOP')).toBeInTheDocument();

    // Search query submit
    mockGetPublicMerchants.mockResolvedValueOnce([
      {
        merchantId: 'm1',
        merchantName: 'ก๋วยเตี๋ยวเรืออยุธยา',
        merchantTypes: ['อาหารและเครื่องดื่ม'],
        description: 'ก๋วยเตี๋ยวน้ำตกสูตรโบราณ',
        address: 'ตลาดน้ำคลองลัดมะยม',
      },
    ]);

    const input = screen.getByLabelText(th.landing.merchantSearchPage.search.label);
    fireEvent.change(input, { target: { value: 'อยุธยา' } });
    fireEvent.click(screen.getByRole('button', { name: th.landing.merchantSearchPage.search.button }));

    await waitFor(() => {
      expect(mockGetPublicMerchants).toHaveBeenCalledWith('อยุธยา', 20);
    });
  });

  it('renders error state and retries', async () => {
    mockGetPublicMerchants.mockRejectedValueOnce(new Error('Network error'));
    render(<MerchantSearchPage onBackToHome={vi.fn()} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();

    mockGetPublicMerchants.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: th.landing.merchantSearchPage.states.retry }));

    await waitFor(() => {
      expect(mockGetPublicMerchants).toHaveBeenCalledTimes(2);
    });
  });
});
