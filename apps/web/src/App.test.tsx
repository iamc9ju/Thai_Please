import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { th } from './i18n/th';

describe('App', () => {
  it('renders the Thai-first product foundation', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: th.heroTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(th.roles.consumer.title)).toBeInTheDocument();
    expect(screen.getByText(th.roles.merchant.title)).toBeInTheDocument();
    expect(screen.getByText(th.roles.administrator.title)).toBeInTheDocument();
  });
});
