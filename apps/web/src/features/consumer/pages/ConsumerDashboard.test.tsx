import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { ConsumerDashboard } from './ConsumerDashboard';

afterEach(cleanup);

function renderDashboard() {
  render(
    <ConsumerDashboard
      citizenId="1100000000001"
      fullName="ทดสอบ ระบบ"
      onLogout={vi.fn()}
    />,
  );
}

function clickFirstNavigation(label: string) {
  fireEvent.click(screen.getAllByRole('button', { name: label })[0]!);
}

describe('ConsumerDashboard', () => {
  it('navigates through the customer wallet and validates top-up input', () => {
    renderDashboard();
    clickFirstNavigation(th.consumerPortal.navigation.wallet);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.consumerPortal.wallet.title,
      }),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByLabelText(th.consumerPortal.wallet.topUpAmount),
      { target: { value: '0' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.wallet.topUpAction,
      }),
    );
    expect(
      screen.getByText(th.consumerPortal.wallet.invalidTopUp),
    ).toBeInTheDocument();

    expect(screen.getByText('ชำระตลาดสดบางรัก')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.wallet.filterMonth,
      }),
    );
    expect(screen.queryByText('ชำระตลาดสดบางรัก')).not.toBeInTheDocument();
    expect(screen.getByText('พบ 3 รายการ')).toBeInTheDocument();
  });

  it('completes the mock payment review and opens its receipt', () => {
    renderDashboard();
    clickFirstNavigation(th.consumerPortal.navigation.payment);

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.demoAction,
      }),
    );
    expect(
      screen.getByText(th.consumerPortal.payment.merchant),
    ).toBeInTheDocument();
    expect(screen.getByText(`฿165.00`)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: th.consumerPortal.payment.confirm }),
    );
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: th.consumerPortal.payment.successTitle,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.receiptAction,
      }),
    );
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.consumerPortal.orders.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerPortal.orders.immutableNote),
    ).toBeInTheDocument();
  });

  it('filters purchase history by a selected date range', () => {
    renderDashboard();
    clickFirstNavigation(th.consumerPortal.navigation.orders);

    expect(screen.getByText('ตลาดสดบางรัก')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(th.consumerPortal.orders.dateFrom), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText(th.consumerPortal.orders.dateTo), {
      target: { value: '2026-10-31' },
    });

    expect(screen.queryByText('ตลาดสดบางรัก')).not.toBeInTheDocument();
    expect(screen.getByText('พบ 3 รายการ')).toBeInTheDocument();
  });

  it('shows completed quest history with its receipt reference', () => {
    renderDashboard();
    clickFirstNavigation(th.consumerPortal.navigation.quests);

    expect(screen.getByText('อุดหนุนร้านอาหารชุมชน')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /ประวัติภารกิจ/ }));

    expect(screen.getByText('ช้อปของใช้ในชุมชน')).toBeInTheDocument();
    expect(screen.getByText(/TP-2569-001044/)).toBeInTheDocument();
  });
});
