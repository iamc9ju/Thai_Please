import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConsumerDashboard } from './ConsumerDashboard';

vi.mock('../api/consumer.api', () => ({
  getConsumerOverview: vi.fn().mockReturnValue(new Promise(() => {})),
}));

describe('ConsumerDashboard', () => {
  it('renders loading state initially', () => {
    render(
      <ConsumerDashboard
        citizenId="1100000000001"
        fullName="ทดสอบ ระบบ"
        onLogout={vi.fn()}
      />,
    );
    expect(screen.getByText('กำลังโหลดข้อมูลกระเป๋าเงิน...')).toBeInTheDocument();
  });
});
