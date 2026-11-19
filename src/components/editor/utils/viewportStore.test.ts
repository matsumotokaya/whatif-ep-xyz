import { describe, it, expect, vi } from 'vitest';
import { ViewportStore, selectArtboardOrigin } from './viewportStore';
import { FIT_PADDING_PX, MAX_VIEW_SCALE, MIN_VISIBLE_ARTBOARD_PX } from './viewportMath';

const artboard = { width: 1080, height: 1920 };
const container = { width: 1000, height: 800 };
const fitScale = (container.height - FIT_PADDING_PX * 2) / artboard.height;

function measured(): ViewportStore {
  const store = new ViewportStore(artboard);
  store.setContainer(container);
  return store;
}

describe('ViewportStore', () => {
  it('fits the artboard the first time the canvas area is measured', () => {
    const store = measured();
    const { view } = store.getState();
    expect(view.scale).toBeCloseTo(fitScale, 9);
    expect(view.offsetX).toBe(0);
    expect(view.offsetY).toBe(0);
  });

  it('refits on resize while the user has not taken over the view', () => {
    const store = measured();
    store.setContainer({ width: 1000, height: 600 });
    expect(store.getState().view.scale).toBeCloseTo((600 - FIT_PADDING_PX * 2) / artboard.height, 9);
  });

  it('keeps the user view when the canvas area is resized after a manual zoom or pan', () => {
    const zoomed = measured();
    zoomed.zoomTo(1);
    zoomed.setContainer({ width: 900, height: 700 });
    expect(zoomed.getState().view.scale).toBe(1);

    const panned = measured();
    panned.pan(30, 0);
    panned.setContainer({ width: 900, height: 700 });
    expect(panned.getState().view.scale).toBeCloseTo(fitScale, 9);
    expect(panned.getState().view.offsetX).toBe(30);
  });

  it('follows the canvas area again after an explicit fit', () => {
    const store = measured();
    store.zoomTo(2);
    store.fit();
    store.setContainer({ width: 1000, height: 600 });
    expect(store.getState().view.scale).toBeCloseTo((600 - FIT_PADDING_PX * 2) / artboard.height, 9);
  });

  it('ignores a zero-size measurement and still fits on the first real one', () => {
    const store = new ViewportStore(artboard);
    store.setContainer({ width: 0, height: 0 });
    store.zoomTo(2);
    expect(store.getState().view.scale).toBe(1);
    store.setContainer(container);
    expect(store.getState().view.scale).toBeCloseTo(fitScale, 9);
  });

  it('keeps the canvas point under the anchor fixed while zooming', () => {
    const store = measured();
    const anchor = { x: 300, y: 250 };
    const before = selectArtboardOrigin(store.getState());
    const scaleBefore = store.getState().view.scale;
    const canvasX = (anchor.x - before.x) / scaleBefore;

    store.zoomAt(anchor, 1.5);
    const after = selectArtboardOrigin(store.getState());
    expect(store.getState().view.scale).toBe(1.5);
    expect((anchor.x - after.x) / 1.5).toBeCloseTo(canvasX, 6);
  });

  it('steps through preset zoom levels and stops at the limit', () => {
    const store = measured();
    store.zoomTo(1);
    store.zoomStep(1);
    expect(store.getState().view.scale).toBe(1.25);
    store.zoomStep(-1);
    store.zoomStep(-1);
    expect(store.getState().view.scale).toBe(0.75);
    store.zoomTo(999);
    expect(store.getState().view.scale).toBe(MAX_VIEW_SCALE);
  });

  it('never lets a pan push the artboard out of reach', () => {
    const store = measured();
    store.pan(99999, 0);
    expect(selectArtboardOrigin(store.getState()).x).toBe(container.width - MIN_VISIBLE_ARTBOARD_PX);
  });

  it('refits when the artboard dimensions change', () => {
    const store = measured();
    store.zoomTo(2);
    store.pan(50, 50);
    store.setArtboard({ width: 1920, height: 1080 });
    const { view } = store.getState();
    expect(view.offsetX).toBe(0);
    expect(view.offsetY).toBe(0);
    expect(view.scale).toBeCloseTo((container.width - FIT_PADDING_PX * 2) / 1920, 9);
  });

  it('fit() restores the fitted, centered view', () => {
    const store = measured();
    store.zoomTo(3);
    store.pan(120, -80);
    store.fit();
    expect(store.getState().view).toEqual({ scale: expect.closeTo(fitScale, 9), offsetX: 0, offsetY: 0 });
  });

  it('notifies subscribers only on a real change', () => {
    const store = measured();
    const listener = vi.fn();
    store.subscribe(listener);

    store.zoomTo(1);
    store.zoomTo(1);
    store.pan(0, 0);
    store.setContainer(container);
    expect(listener).toHaveBeenCalledTimes(1);

    store.panTo(10, 10);
    store.panTo(10, 10);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
