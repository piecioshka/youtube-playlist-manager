import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/renderWithI18n';
import { ErrorBoundary } from './ErrorBoundary';

function Broken(): never {
  throw new Error('render failed');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React wypisuje złapany błąd na konsolę; w teście to szum
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing fails', () => {
    renderWithI18n(
      <ErrorBoundary onReload={() => undefined}>
        <p>treść</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('treść')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a message instead of a blank page when rendering throws', () => {
    renderWithI18n(
      <ErrorBoundary onReload={() => undefined}>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Coś poszło nie tak i nie da się wyświetlić strony.',
    );
  });

  it('speaks the current language', () => {
    renderWithI18n(
      <ErrorBoundary onReload={() => undefined}>
        <Broken />
      </ErrorBoundary>,
      'en',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrong and the page cannot be shown.',
    );
  });

  it('reloads on demand', async () => {
    const onReload = vi.fn();
    renderWithI18n(
      <ErrorBoundary onReload={onReload}>
        <Broken />
      </ErrorBoundary>,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Odśwież stronę' }),
    );
    expect(onReload).toHaveBeenCalledOnce();
  });
});
