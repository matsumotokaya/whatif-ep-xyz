import { describe, it, expect } from 'vitest';
import {
  FIT_PADDING_PX,
  MAX_VIEW_SCALE,
  MIN_VIEW_SCALE,
  MIN_VISIBLE_ARTBOARD_PX,
  clampViewScale,
  constrainView,
  containerToCanvas,
  fitView,
  getArtboardOrigin,
  isInsideBleedZone,
  panBy,
  scaleToSliderValue,
  sliderValueToScale,
  stepZoomScale,
  wheelZoomScale,
  zoomAtCenter,
  zoomAtPoint,
  type ViewState,
} from './viewportMath';

const container = { width: 1000, height: 800 };
const artboard = { width: 1080, height: 1920 };
const centered = (scale: number): ViewState => ({ scale, offsetX: 0, offsetY: 0 });

describe('clampViewScale', () => {
  it('limits the scale to the supported range', () => {
    expect(clampViewScale(0.001)).toBe(MIN_VIEW_SCALE);
    expect(clampViewScale(99)).toBe(MAX_VIEW_SCALE);
    expect(clampViewScale(0.4)).toBe(0.4);
  });

  it('falls back for values that are not a usable scale', () => {
    expect(clampViewScale(Number.NaN, 0.4)).toBe(0.4);
    expect(clampViewScale(Number.POSITIVE_INFINITY, 0.4)).toBe(0.4);
    expect(clampViewScale(0, 0.4)).toBe(0.4);
    expect(clampViewScale(-1, 0.4)).toBe(0.4);
  });
});

describe('getArtboardOrigin / containerToCanvas', () => {
  it('centers the artboard when there is no pan', () => {
    expect(getArtboardOrigin(centered(0.25), container, artboard)).toEqual({ x: 365, y: 160 });
  });

  it('shifts the artboard by the pan offset', () => {
    expect(getArtboardOrigin({ scale: 0.25, offsetX: 40, offsetY: -10 }, container, artboard)).toEqual({ x: 405, y: 150 });
  });

  it('maps container points to canvas units', () => {
    const view = { scale: 0.25, offsetX: 40, offsetY: -10 };
    expect(containerToCanvas({ x: 405, y: 150 }, view, container, artboard)).toEqual({ x: 0, y: 0 });
    expect(containerToCanvas({ x: 505, y: 400 }, view, container, artboard)).toEqual({ x: 400, y: 1000 });
  });
});

describe('zoomAtPoint', () => {
  it('keeps the canvas point under the anchor fixed', () => {
    const view = { scale: 0.25, offsetX: 30, offsetY: -20 };
    const anchor = { x: 620, y: 310 };
    const before = containerToCanvas(anchor, view, container, artboard);
    const zoomed = zoomAtPoint(view, container, artboard, anchor, 0.6);
    const after = containerToCanvas(anchor, zoomed, container, artboard);

    expect(zoomed.scale).toBe(0.6);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('returns to the original view after zooming in and back out at the same point', () => {
    const view = { scale: 0.3, offsetX: 12, offsetY: 7 };
    const anchor = { x: 400, y: 500 };
    const roundTrip = zoomAtPoint(zoomAtPoint(view, container, artboard, anchor, 1.2), container, artboard, anchor, 0.3);
    expect(roundTrip.scale).toBeCloseTo(0.3, 9);
    expect(roundTrip.offsetX).toBeCloseTo(12, 6);
    expect(roundTrip.offsetY).toBeCloseTo(7, 6);
  });

  it('keeps a centered artboard centered when zooming at the container center', () => {
    const zoomed = zoomAtCenter(centered(0.25), container, artboard, 0.5);
    expect(zoomed).toEqual({ scale: 0.5, offsetX: 0, offsetY: 0 });
  });

  it('clamps to the supported range and returns the same view when nothing changes', () => {
    const max = centered(MAX_VIEW_SCALE);
    expect(zoomAtCenter(max, container, artboard, 50)).toBe(max);
    expect(zoomAtCenter(centered(1), container, artboard, 0.0001).scale).toBe(MIN_VIEW_SCALE);
  });
});

describe('constrainView / panBy', () => {
  it('leaves a view alone while enough of the artboard is visible', () => {
    const view = { scale: 0.25, offsetX: 100, offsetY: -100 };
    expect(constrainView(view, container, artboard)).toBe(view);
  });

  it('stops a pan before the artboard leaves the container', () => {
    const pannedRight = panBy(centered(0.25), container, artboard, 5000, 0);
    const origin = getArtboardOrigin(pannedRight, container, artboard);
    expect(origin.x).toBe(container.width - MIN_VISIBLE_ARTBOARD_PX);

    const pannedUp = panBy(centered(0.25), container, artboard, 0, -5000);
    const top = getArtboardOrigin(pannedUp, container, artboard);
    expect(top.y + artboard.height * 0.25).toBe(MIN_VISIBLE_ARTBOARD_PX);
  });

  it('keeps a tiny artboard fully reachable', () => {
    const tiny = { width: 100, height: 100 };
    const panned = panBy(centered(0.1), container, tiny, -9999, 0);
    const origin = getArtboardOrigin(panned, container, tiny);
    // The whole 10px artboard stays inside the left edge.
    expect(origin.x).toBeCloseTo(0, 6);
  });

  it('ignores a pan that is not a number', () => {
    const view = centered(0.25);
    expect(panBy(view, container, artboard, Number.NaN, 4)).toBe(view);
    expect(panBy(view, container, artboard, 0, 0)).toBe(view);
  });

  it('does not constrain before the container has been measured', () => {
    const view = { scale: 1, offsetX: 9999, offsetY: 0 };
    expect(constrainView(view, { width: 0, height: 0 }, artboard)).toBe(view);
  });
});

describe('fitView', () => {
  it('fits the limiting axis inside the padded container and centers it', () => {
    const view = fitView(container, artboard);
    expect(view.offsetX).toBe(0);
    expect(view.offsetY).toBe(0);
    expect(view.scale).toBeCloseTo((container.height - FIT_PADDING_PX * 2) / artboard.height, 9);
    expect(artboard.width * view.scale).toBeLessThanOrEqual(container.width - FIT_PADDING_PX * 2);
  });

  it('never returns a scale outside the supported range', () => {
    expect(fitView({ width: 10, height: 10 }, artboard).scale).toBe(MIN_VIEW_SCALE);
    expect(fitView({ width: 90000, height: 90000 }, { width: 10, height: 10 }).scale).toBe(MAX_VIEW_SCALE);
  });
});

describe('wheelZoomScale', () => {
  it('zooms in for a negative delta and out for a positive one', () => {
    expect(wheelZoomScale(1, -5)).toBeGreaterThan(1);
    expect(wheelZoomScale(1, 5)).toBeLessThan(1);
  });

  it('is symmetric: the same travel in and out returns to the start', () => {
    expect(wheelZoomScale(wheelZoomScale(0.4, -8), 8)).toBeCloseTo(0.4, 9);
  });

  it('caps one event so a mouse wheel notch is a single moderate step', () => {
    const notch = wheelZoomScale(1, -120);
    expect(notch).toBeCloseTo(Math.exp(0.2), 9);
    expect(wheelZoomScale(1, -5000)).toBe(notch);
  });

  it('treats line-mode deltas as a wheel notch', () => {
    expect(wheelZoomScale(1, -3, 1)).toBeCloseTo(Math.exp(0.2), 9);
  });

  it('ignores an event without a usable delta', () => {
    expect(wheelZoomScale(0.4, 0)).toBe(0.4);
    expect(wheelZoomScale(0.4, Number.NaN)).toBe(0.4);
  });
});

describe('stepZoomScale', () => {
  it('moves to the next preset level in each direction', () => {
    expect(stepZoomScale(0.4, 1)).toBe(0.5);
    expect(stepZoomScale(0.4, -1)).toBe(0.33);
    expect(stepZoomScale(1, 1)).toBe(1.25);
    expect(stepZoomScale(1, -1)).toBe(0.75);
  });

  it('stays at the ends of the range', () => {
    expect(stepZoomScale(MAX_VIEW_SCALE, 1)).toBe(MAX_VIEW_SCALE);
    expect(stepZoomScale(MIN_VIEW_SCALE, -1)).toBe(MIN_VIEW_SCALE);
  });
});

describe('zoom slider mapping', () => {
  it('maps the range ends to 0 and 1', () => {
    expect(scaleToSliderValue(MIN_VIEW_SCALE)).toBeCloseTo(0, 9);
    expect(scaleToSliderValue(MAX_VIEW_SCALE)).toBeCloseTo(1, 9);
    expect(sliderValueToScale(0)).toBeCloseTo(MIN_VIEW_SCALE, 9);
    expect(sliderValueToScale(1)).toBeCloseTo(MAX_VIEW_SCALE, 9);
  });

  it('round-trips a scale through the slider', () => {
    for (const scale of [0.1, 0.4, 1, 2.5]) {
      expect(sliderValueToScale(scaleToSliderValue(scale))).toBeCloseTo(scale, 9);
    }
  });

  it('is logarithmic: 100% sits past the middle of the track', () => {
    expect(scaleToSliderValue(1)).toBeGreaterThan(0.5);
    expect(scaleToSliderValue(0.5)).toBeCloseTo(0.5, 9);
  });

  it('clamps out-of-range slider input', () => {
    expect(sliderValueToScale(-3)).toBeCloseTo(MIN_VIEW_SCALE, 9);
    expect(sliderValueToScale(7)).toBeCloseTo(MAX_VIEW_SCALE, 9);
    expect(sliderValueToScale(Number.NaN)).toBeCloseTo(MIN_VIEW_SCALE, 9);
  });
});

describe('isInsideBleedZone', () => {
  it('includes the artboard and the band around it', () => {
    expect(isInsideBleedZone({ x: 500, y: 500 }, artboard, 400)).toBe(true);
    expect(isInsideBleedZone({ x: -400, y: -400 }, artboard, 400)).toBe(true);
    expect(isInsideBleedZone({ x: 1480, y: 2320 }, artboard, 400)).toBe(true);
  });

  it('excludes points beyond the band', () => {
    expect(isInsideBleedZone({ x: -401, y: 0 }, artboard, 400)).toBe(false);
    expect(isInsideBleedZone({ x: 0, y: 2321 }, artboard, 400)).toBe(false);
  });
});
