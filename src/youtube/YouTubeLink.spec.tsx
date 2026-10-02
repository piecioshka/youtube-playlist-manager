import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { YouTubeLink } from './YouTubeLink';

describe('YouTubeLink', () => {
  it('opens YouTube in a new tab and ends with a decorative icon', () => {
    render(
      <YouTubeLink href="https://www.youtube.com/watch?v=abc" title="Quicksort">
        Quicksort
      </YouTubeLink>,
    );
    const link = screen.getByRole('link', { name: 'Quicksort' });

    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link).toHaveAttribute('title', 'Quicksort');
    expect(link).toHaveClass('external-link');
    // Podkreślenie dostaje sam tekst, a piktogram stoi za nim
    expect(link.firstElementChild).toHaveClass('external-link__text');
    expect(link.lastElementChild).toHaveClass('external-link__icon');
    expect(link.lastElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the class of the place it is used in', () => {
    render(
      <YouTubeLink href="https://www.youtube.com" className="app__footer-link">
        YouTube
      </YouTubeLink>,
    );

    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveClass(
      'external-link',
      'app__footer-link',
    );
  });
});
