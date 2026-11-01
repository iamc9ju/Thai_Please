import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { LoginPage } from './LoginPage';

const mockLogin = vi.fn();

vi.mock('../use-auth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
    isAuthenticated: false,
    logout: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

describe('LoginPage remember credentials', () => {
  beforeEach(() => {
    localStorage.clear();
    mockLogin.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders remember credentials checkbox', () => {
    render(<LoginPage />);

    const checkbox = screen.getByLabelText(th.login.rememberCredentials);
    expect(checkbox).toBeInTheDocument();
  });

  it('saves credentials to localStorage on successful login when checked', async () => {
    render(<LoginPage />);

    const citizenInput = screen.getByLabelText(th.login.fields.citizenId.label);
    const passwordInput = screen.getByLabelText(th.login.fields.password.label);
    const checkbox = screen.getByLabelText(th.login.rememberCredentials);
    const submitBtn = screen.getByRole('button', { name: th.login.submit });

    fireEvent.change(citizenInput, { target: { value: '1100000000001' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret@123' } });

    if (!checkbox.getAttribute('checked')) {
      fireEvent.click(checkbox);
    }

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('consumer', {
        citizenId: '1100000000001',
        password: 'Secret@123',
      });
    });

    const storedRaw = localStorage.getItem(
      'thai_please_remembered_credentials',
    );
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw || '{}');
    expect(stored.consumer).toEqual({
      citizenId: '1100000000001',
      password: 'Secret@123',
    });
  });

  it('restores remembered credentials on initial mount and can clear them', async () => {
    localStorage.setItem(
      'thai_please_remembered_credentials',
      JSON.stringify({
        consumer: {
          citizenId: '1234567890123',
          password: 'SavedPassword@1',
        },
      }),
    );

    render(<LoginPage />);

    const citizenInput = screen.getByLabelText(th.login.fields.citizenId.label);
    const passwordInput = screen.getByLabelText(th.login.fields.password.label);

    expect(citizenInput).toHaveValue('1234567890123');
    expect(passwordInput).toHaveValue('SavedPassword@1');

    const clearBtn = screen.getByTitle(th.login.clearSaved);
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    expect(citizenInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');
  });

  it('shows the backend message when valid credentials do not have the selected role', async () => {
    mockLogin.mockRejectedValueOnce(
      new Error('บัญชีนี้ยังไม่ได้ลงทะเบียนในบทบาทประชาชน'),
    );
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(th.login.fields.citizenId.label), {
      target: { value: '1100000000001' },
    });
    fireEvent.change(screen.getByLabelText(th.login.fields.password.label), {
      target: { value: 'Secret@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: th.login.submit }));

    expect(
      await screen.findByText('บัญชีนี้ยังไม่ได้ลงทะเบียนในบทบาทประชาชน'),
    ).toBeInTheDocument();
  });
});
