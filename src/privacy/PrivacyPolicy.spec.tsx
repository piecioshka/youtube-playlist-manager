import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from '../test/renderWithI18n';
import { PrivacyPolicy } from './PrivacyPolicy';

describe('PrivacyPolicy', () => {
  it('names the scope, the storage and the links Google asks for', () => {
    renderWithI18n(<PrivacyPolicy />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Polityka prywatności' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/https:\/\/www\.googleapis\.com\/auth\/youtube/),
    ).toBeInTheDocument();
    expect(screen.getByText(/sessionStorage/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Uprawnienia konta Google' }),
    ).toHaveAttribute('href', 'https://myaccount.google.com/permissions');
    expect(
      screen.getByRole('link', { name: 'Warunki korzystania z YouTube' }),
    ).toHaveAttribute('href', 'https://www.youtube.com/t/terms');
    expect(
      screen.getByRole('link', { name: 'Polityka prywatności Google' }),
    ).toHaveAttribute('href', 'https://policies.google.com/privacy');
  });

  it('opens every external link in a new tab', () => {
    renderWithI18n(<PrivacyPolicy />, 'en');

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
    }
  });
});
