import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionHeading } from './section-heading';

describe('SectionHeading', () => {
  it('renders the title as the section heading', () => {
    render(<SectionHeading eyebrow="Nearby" title="Explore Darjeeling" lede="A short line." />);

    expect(screen.getByRole('heading', { name: 'Explore Darjeeling' })).toBeInTheDocument();
    expect(screen.getByText('Nearby')).toBeInTheDocument();
    expect(screen.getByText('A short line.')).toBeInTheDocument();
  });

  it('uses one heading size whatever the tone, so sections line up', () => {
    const { rerender } = render(<SectionHeading title="Rooms" />);
    const light = screen.getByRole('heading', { name: 'Rooms' }).className;

    rerender(<SectionHeading title="Rooms" tone="dark" />);
    const dark = screen.getByRole('heading', { name: 'Rooms' }).className;

    expect(light).toContain('text-3xl sm:text-4xl');
    expect(dark).toContain('text-3xl sm:text-4xl');
  });

  it('drops the top margin when there is no eyebrow above the title', () => {
    render(<SectionHeading title="Gallery" />);

    expect(screen.getByRole('heading', { name: 'Gallery' }).className).not.toContain('mt-3');
  });
});
