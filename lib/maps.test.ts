import { mapsEmbedEnabled } from '@/lib/maps';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mapsEmbedEnabled', () => {
  it('leaves the frame out where nobody has confirmed it renders', () => {
    vi.stubEnv('NEXT_PUBLIC_MAPS_EMBED', undefined);
    expect(mapsEmbedEnabled()).toBe(false);
  });

  it('shows the frame only for the exact opt-in', () => {
    vi.stubEnv('NEXT_PUBLIC_MAPS_EMBED', 'on');
    expect(mapsEmbedEnabled()).toBe(true);
  });

  it('is not switched on by a value that merely looks affirmative', () => {
    vi.stubEnv('NEXT_PUBLIC_MAPS_EMBED', 'true');
    expect(mapsEmbedEnabled()).toBe(false);
  });
});
