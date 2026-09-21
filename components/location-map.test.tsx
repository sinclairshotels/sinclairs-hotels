import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocationMap } from './location-map';

const props = {
  address: '18/1 Gandhi Road, Darjeeling 734101, West Bengal, India',
  query: 'Sinclairs Darjeeling, Darjeeling, West Bengal',
  embedUrl: 'https://maps.google.com/maps?q=Sinclairs%20Darjeeling&output=embed',
  title: 'Map showing Sinclairs Darjeeling',
};

describe('LocationMap', () => {
  it('shows the address and a link to Google Maps whether or not a map is drawn', () => {
    const { rerender } = render(<LocationMap {...props} />);
    expect(screen.getByText(props.address)).toBeInTheDocument();

    rerender(<LocationMap {...props} enabled />);
    expect(screen.getByText(props.address)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in google maps/i })).toBeInTheDocument();
  });

  it('builds a Google Maps link from the property, not the embed URL', () => {
    render(<LocationMap {...props} />);

    expect(screen.getByRole('link', { name: /open in google maps/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Sinclairs%20Darjeeling%2C%20Darjeeling%2C%20West%20Bengal',
    );
  });

  it('leaves the frame out unless the environment has confirmed it renders', () => {
    const { container } = render(<LocationMap {...props} />);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('draws the frame over the address once the environment opts in', () => {
    const { container } = render(<LocationMap {...props} enabled />);

    expect(container.querySelector('iframe')).toHaveAttribute('src', props.embedUrl);
    expect(container.querySelector('iframe')).toHaveAttribute('title', props.title);
  });

  it('never renders a frame for a property with no embed URL, opted in or not', () => {
    const { container } = render(<LocationMap {...props} embedUrl={undefined} enabled />);

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: /open in google maps/i })).toBeInTheDocument();
  });

  it('opens Google Maps in a new tab without handing it this window', () => {
    render(<LocationMap {...props} />);

    const link = screen.getByRole('link', { name: /open in google maps/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
