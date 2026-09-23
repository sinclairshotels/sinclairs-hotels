import { describe, expect, it } from 'vitest';
import { mergeMounted, slidesToMount } from './carousel-mount';

describe('slidesToMount', () => {
  it('starts with the slide showing and the one after it', () => {
    expect([...slidesToMount(0, 9)]).toEqual([0, 1]);
  });

  it('wraps at the end rather than running off it', () => {
    expect([...slidesToMount(8, 9)]).toEqual([8, 0]);
  });

  it('mounts the one slide of a single-image carousel once, not twice', () => {
    expect([...slidesToMount(0, 1)]).toEqual([0]);
  });

  it('is empty for no slides', () => {
    expect([...slidesToMount(0, 0)]).toEqual([]);
  });

  // A guest clicking straight to slide seven should load seven and eight, not
  // the six in between they skipped.
  it('jumps without dragging the skipped slides along', () => {
    expect([...slidesToMount(7, 9)]).toEqual([7, 8]);
  });
});

describe('mergeMounted', () => {
  it('keeps what has already been shown', () => {
    expect([...mergeMounted(new Set([0, 1]), new Set([1, 2]))]).toEqual([0, 1, 2]);
  });

  // Returning the same Set is what stops the effect looping: a new Set every
  // render would be a new state value every render.
  it('returns the same set when nothing is new', () => {
    const current = new Set([0, 1, 2]);
    expect(mergeMounted(current, new Set([1, 2]))).toBe(current);
  });
});
