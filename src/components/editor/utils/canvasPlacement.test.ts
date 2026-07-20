import { describe, expect, it } from 'vitest';
import { getFitToCanvasPlacement } from './canvasPlacement';

describe('getFitToCanvasPlacement', () => {
  it('covers a landscape canvas with a portrait image without side gaps', () => {
    const placement = getFitToCanvasPlacement(2560, 1440, 1000, 2000);

    expect(placement.width).toBe(2560);
    expect(placement.height).toBe(5120);
    expect(placement.x).toBe(0);
    expect(placement.y).toBe(-1840);
  });

  it('covers a portrait canvas with a landscape image without top or bottom gaps', () => {
    const placement = getFitToCanvasPlacement(1440, 2560, 2000, 1000);

    expect(placement.width).toBe(5120);
    expect(placement.height).toBe(2560);
    expect(placement.x).toBe(-1840);
    expect(placement.y).toBe(0);
  });

  it('centers an image when the aspect ratios match', () => {
    expect(getFitToCanvasPlacement(1080, 1350, 800, 1000)).toEqual({
      x: 0,
      y: 0,
      width: 1080,
      height: 1350,
    });
  });

  it('returns a safe empty placement for invalid dimensions', () => {
    expect(getFitToCanvasPlacement(1080, 1350, 0, 1000)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});
