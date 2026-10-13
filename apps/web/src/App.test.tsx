import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { th } from './i18n/th';

afterEach(() => {
  cleanup();
});

describe('App', () => {
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

  it('accepts only 13 citizen-id digits before enabling login', () => {
    render(<App />);

    const citizenId = screen.getByLabelText(th.login.fields.citizenId.label);
    const password = screen.getByLabelText(th.login.fields.password.label);
    const submit = screen.getByRole('button', { name: th.login.submit });

    fireEvent.change(citizenId, { target: { value: '1a2345678901234' } });
    fireEvent.change(password, { target: { value: 'Prototype#1' } });

    expect(citizenId).toHaveValue('1234567890123');
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(screen.getByText(th.login.prototypeFeedback)).toBeInTheDocument();
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
});
