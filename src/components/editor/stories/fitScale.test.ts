import { describe, it, expect } from 'vitest';
import { computeFitScale, MIN_FIT_SCALE } from './fitScale';

describe('computeFitScale', () => {
  it('fits a portrait canvas into a portrait phone viewport (width-bound)', () => {
    // 1080x1920 artboard on a 390x700 usable area with 16px padding:
    // width ratio (390-32)/1080 = 0.3315 < height ratio (700-32)/1920 = 0.3479
    const scale = computeFitScale({
      containerWidth: 390,
      containerHeight: 700,
      canvasWidth: 1080,
      canvasHeight: 1920,
      padding: 16,
    });
    expect(scale).toBeCloseTo((390 - 32) / 1080, 6);
  });

  it('fits a landscape canvas into a portrait viewport (height stays bound by width)', () => {
    const scale = computeFitScale({
      containerWidth: 390,
      containerHeight: 700,
      canvasWidth: 1920,
      canvasHeight: 1080,
      padding: 16,
    });
    expect(scale).toBeCloseTo((390 - 32) / 1920, 6);
  });

  it('is height-bound when the canvas aspect is wider than the container aspect allows', () => {
    const scale = computeFitScale({
      containerWidth: 1000,
      containerHeight: 300,
      canvasWidth: 800,
      canvasHeight: 800,
      padding: 0,
    });
    expect(scale).toBeCloseTo(300 / 800, 6);
  });

  it('subtracts padding from both sides', () => {
    const withPadding = computeFitScale({
      containerWidth: 400,
      containerHeight: 400,
      canvasWidth: 100,
      canvasHeight: 100,
      padding: 50,
    });
    expect(withPadding).toBeCloseTo(3, 6); // (400-100)/100
  });

  it('upscales small canvases so they still fill the screen', () => {
    const scale = computeFitScale({
      containerWidth: 800,
      containerHeight: 800,
      canvasWidth: 200,
      canvasHeight: 200,
      padding: 0,
    });
    expect(scale).toBe(4);
  });

  it('defaults padding to 16', () => {
    const scale = computeFitScale({
      containerWidth: 132,
      containerHeight: 132,
      canvasWidth: 100,
      canvasHeight: 100,
    });
    expect(scale).toBeCloseTo(1, 6); // (132-32)/100
  });

  it('returns MIN_FIT_SCALE for degenerate containers', () => {
    expect(
      computeFitScale({ containerWidth: 0, containerHeight: 500, canvasWidth: 100, canvasHeight: 100 })
    ).toBe(MIN_FIT_SCALE);
    expect(
      computeFitScale({ containerWidth: 20, containerHeight: 20, canvasWidth: 100, canvasHeight: 100, padding: 16 })
    ).toBe(MIN_FIT_SCALE);
  });

  it('returns MIN_FIT_SCALE for invalid canvas dimensions', () => {
    expect(
      computeFitScale({ containerWidth: 500, containerHeight: 500, canvasWidth: 0, canvasHeight: 100 })
    ).toBe(MIN_FIT_SCALE);
    expect(
      computeFitScale({ containerWidth: 500, containerHeight: 500, canvasWidth: NaN, canvasHeight: 100 })
    ).toBe(MIN_FIT_SCALE);
  });

  it('never returns a scale below MIN_FIT_SCALE', () => {
    const scale = computeFitScale({
      containerWidth: 3,
      containerHeight: 3,
      canvasWidth: 100000,
      canvasHeight: 100000,
      padding: 1,
    });
    expect(scale).toBe(MIN_FIT_SCALE);
  });
});
