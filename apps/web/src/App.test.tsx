import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { th } from './i18n/th';
import { authenticateMockUser, mockUsers } from './login/mockUsers';

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('configures a working mock account for every supported role', () => {
    for (const role of ['consumer', 'merchant', 'administrator'] as const) {
      const account = mockUsers[role];

      expect(account.citizenId).toMatch(/^\d{13}$/);
      expect(
        authenticateMockUser(role, account.citizenId, account.password),
      ).toBe(true);
    }
  });

  it('renders the EPP-style login for all supported roles', () => {
    render(<App />);

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

  it('accepts the consumer mock account and opens the dashboard', () => {
    render(<App />);

    const citizenId = screen.getByLabelText(th.login.fields.citizenId.label);
    const password = screen.getByLabelText(th.login.fields.password.label);
    const submit = screen.getByRole('button', { name: th.login.submit });

    fireEvent.change(citizenId, {
      target: { value: `x${mockUsers.consumer.citizenId}` },
    });
    fireEvent.change(password, {
      target: { value: mockUsers.consumer.password },
    });

    expect(citizenId).toHaveValue(mockUsers.consumer.citizenId);
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.consumerDashboard.displayName,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerDashboard.wallet.title),
    ).toBeInTheDocument();
  });

  it('rejects credentials that do not match the selected role', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(th.login.fields.citizenId.label), {
      target: { value: mockUsers.consumer.citizenId },
    });
    fireEvent.change(screen.getByLabelText(th.login.fields.password.label), {
      target: { value: 'Wrong@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: th.login.submit }));

    expect(screen.getByText(th.login.invalidCredentials)).toBeInTheDocument();
  });

  it('shows registration for consumers and merchants but not administrators', () => {
    render(<App />);

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

  it('opens the consumer registration form from the login page', () => {
    render(<App />);

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

  it('opens the merchant registration form with merchant details', () => {
    render(<App />);

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
