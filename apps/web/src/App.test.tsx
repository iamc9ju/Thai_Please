import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { th } from './i18n/th';

vi.mock('./api/auth.api', () => ({
  login: vi.fn(),
  getMe: vi.fn().mockResolvedValue(null),
  logout: vi.fn().mockResolvedValue({ success: true }),
  registerConsumer: vi.fn().mockResolvedValue({
    success: true,
    citizenId: '1100000000001',
    fullName: 'ทดสอบ ระบบ',
  }),
  registerMerchant: vi.fn().mockResolvedValue({
    success: true,
    merchantId: '1',
    merchantName: 'ร้านค้าทดสอบ',
  }),
}));

afterEach(() => {
  cleanup();
});

async function renderApp() {
  render(<App />);
  return screen.findByRole('heading', { level: 2, name: th.login.title });
}

describe('App', () => {
  it('renders the login page for all supported roles', async () => {
    await renderApp();

    expect(
      screen.getByRole('heading', { level: 2, name: th.login.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.login.role.options.consumer }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: th.login.role.options.merchant }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: th.login.role.options.administrator,
      }),
    ).toBeInTheDocument();
  });

  it('validates citizen id input length', async () => {
    await renderApp();

    const citizenId = screen.getByLabelText(th.login.fields.citizenId.label);
    const password = screen.getByLabelText(th.login.fields.password.label);
    const submit = screen.getByRole('button', { name: th.login.submit });

    expect(submit).toBeDisabled();

    fireEvent.change(citizenId, {
      target: { value: '1100000000001' },
    });
    fireEvent.change(password, {
      target: { value: 'ThaiPlease@2026' },
    });

    expect(citizenId).toHaveValue('1100000000001');
    expect(submit).toBeEnabled();
  });

  it('shows registration for consumers and merchants but not administrators', async () => {
    await renderApp();

    expect(
      screen.getByRole('button', {
        name: th.login.registration.actions.consumer,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: th.login.role.options.merchant }),
    );
    expect(
      screen.getByRole('button', {
        name: th.login.registration.actions.merchant,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: th.login.role.options.administrator,
      }),
    );
    expect(
      screen.queryByText(th.login.registration.prompt),
    ).not.toBeInTheDocument();
  });

  it('opens the consumer registration form from the login page', async () => {
    await renderApp();

    fireEvent.click(
      screen.getByRole('button', {
        name: th.login.registration.actions.consumer,
      }),
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.registration.title.consumer,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {
        name: new RegExp(th.registration.fields.citizenId),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(th.registration.sections.merchant.title),
    ).not.toBeInTheDocument();
  });

  it('opens the merchant registration form with merchant details', async () => {
    await renderApp();

    fireEvent.click(
      screen.getByRole('button', { name: th.login.role.options.merchant }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: th.login.registration.actions.merchant,
      }),
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.registration.title.merchant,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: th.registration.sections.merchant.title,
      }),
    ).toBeInTheDocument();
  });
});
