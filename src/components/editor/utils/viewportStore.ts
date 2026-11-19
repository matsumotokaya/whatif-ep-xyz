import {
  clampViewScale,
  constrainView,
  fitView,
  getArtboardOrigin,
  panBy,
  stepZoomScale,
  zoomAtCenter,
  zoomAtPoint,
  type Point,
  type Size,
  type ViewState,
} from './viewportMath';

export interface ViewportState {
  view: ViewState;
  // Size of the canvas area in CSS px; zero until it has been measured.
  container: Size;
  artboard: Size;
}

// Zoom and pan of the Studio canvas, kept outside React state so that only the
// canvas area and the zoom readout re-render while the user scrolls or pinches
// (the rest of the editor does not depend on the view).
export class ViewportStore {
  private state: ViewportState;
  private readonly listeners = new Set<() => void>();
  // While true the view tracks "fit to screen": it is fitted on the first
  // measurement and refitted when the canvas area resizes. Any manual zoom or
  // pan hands the view over to the user until they ask for a fit again.
  private fitsToContainer = true;

  constructor(artboard: Size) {
    this.state = {
      view: { scale: 1, offsetX: 0, offsetY: 0 },
      container: { width: 0, height: 0 },
      artboard,
    };
  }

  getState = (): ViewportState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private get isMeasured(): boolean {
    return this.state.container.width > 0 && this.state.container.height > 0;
  }

  private commit(next: ViewportState): void {
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }

  private setView(view: ViewState, fitsToContainer = false): void {
    if (view === this.state.view) {
      // A request that changed nothing is not the user taking over.
      if (fitsToContainer) this.fitsToContainer = true;
      return;
    }
    this.fitsToContainer = fitsToContainer;
    this.commit({ ...this.state, view });
  }

  // The canvas area was measured or resized.
  setContainer(container: Size): void {
    const { container: previous, artboard, view } = this.state;
    if (previous.width === container.width && previous.height === container.height) return;

    const measured = container.width > 0 && container.height > 0;
    const nextView = measured && this.fitsToContainer
      ? fitView(container, artboard)
      : constrainView(view, container, artboard);
    this.commit({ ...this.state, container, view: nextView });
  }

  // The artboard dimensions changed (canvas size preset): show all of it.
  setArtboard(artboard: Size): void {
    const { artboard: previous, container } = this.state;
    if (previous.width === artboard.width && previous.height === artboard.height) return;
    this.fitsToContainer = true;
    this.commit({
      ...this.state,
      artboard,
      view: this.isMeasured ? fitView(container, artboard) : this.state.view,
    });
  }

  fit(): void {
    if (!this.isMeasured) return;
    const fitted = fitView(this.state.container, this.state.artboard);
    const { view } = this.state;
    const unchanged =
      fitted.scale === view.scale && fitted.offsetX === view.offsetX && fitted.offsetY === view.offsetY;
    this.setView(unchanged ? view : fitted, true);
  }

  // Zoom keeping the canvas point under `anchor` (container coordinates) fixed.
  zoomAt(anchor: Point, scale: number): void {
    if (!this.isMeasured) return;
    const { view, container, artboard } = this.state;
    this.setView(zoomAtPoint(view, container, artboard, anchor, scale));
  }

  // Zoom about the center of the canvas area (buttons, slider, keyboard).
  zoomTo(scale: number): void {
    if (!this.isMeasured) return;
    const { view, container, artboard } = this.state;
    this.setView(zoomAtCenter(view, container, artboard, clampViewScale(scale, view.scale)));
  }

  zoomStep(direction: 1 | -1): void {
    this.zoomTo(stepZoomScale(this.state.view.scale, direction));
  }

  pan(dx: number, dy: number): void {
    if (!this.isMeasured) return;
    const { view, container, artboard } = this.state;
    this.setView(panBy(view, container, artboard, dx, dy));
  }

  // Absolute pan offset, for a drag that tracks its start position.
  panTo(offsetX: number, offsetY: number): void {
    if (!this.isMeasured) return;
    const { view, container, artboard } = this.state;
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return;
    const next = constrainView({ scale: view.scale, offsetX, offsetY }, container, artboard);
    if (next.offsetX === view.offsetX && next.offsetY === view.offsetY) return;
    this.setView(next);
  }
}

// Container position of the artboard's top-left corner for a viewport state.
export function selectArtboardOrigin(state: ViewportState): Point {
  return getArtboardOrigin(state.view, state.container, state.artboard);
}
