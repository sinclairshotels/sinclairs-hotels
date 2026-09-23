import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// jsdom implements no media queries at all, so anything that asks the browser
// how wide it is throws rather than returning false. The date picker asks, to
// decide whether it has room for two months. Reporting "no match" gives every
// component test the narrow layout, which is the one that has to work anyway.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      // Deprecated pair, still called by some libraries.
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  cleanup();
});
