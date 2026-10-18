import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Konva from 'konva';
import type { CanvasRef } from '../components/Canvas';
import type { CanvasElement } from '../types/template';

// Run the real animation effect with controlled timers, but deliberately no
// animation frames. This models a busy/background tab, not a fast happy path.
const harness = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  setPhase: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('react', () => ({
  useState: () => ['animating', harness.setPhase],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect),
}));
vi.mock('konva', () => ({ default: {
  Easings: { EaseOut: () => {} },
  Tween: class {
    play() { /* Frames intentionally stalled. */ }
    destroy() { harness.destroy(); }
  },
} }));
import { useEntranceAnimation } from './useEntranceAnimation';

function AnimationHarness() {
  const elements: CanvasElement[] = [0, 1, 2].map(index => ({
    id: String(index), type: 'image', src: 'test.png',
    x: 0, y: index * 100, width: 100, height: 100,
    opacity: index === 1 ? 0.4 : 1,
  }));
  const nodes = elements.map(element => {
    let y = element.y;
    let opacity = element.opacity!;
    return {
      y(value?: number) { if (value !== undefined) y = value; return y; },
      opacity(value?: number) { if (value !== undefined) opacity = value; return opacity; },
    };
  });
  const nodesMap = new Map(nodes.map((node, index) => [String(index), node as unknown as Konva.Node]));
  const batchDraw = vi.fn();
  const canvasRef = { current: {
    getNodesMap: () => nodesMap,
    getLayerNode: () => ({ batchDraw }),
  } as unknown as CanvasRef };
  useEntranceAnimation({ elements, canvasRef, imageLoadStatus: new Map(), totalImageCount: 3, enabled: true });
  const runAnimation = harness.effects[2];
  return { nodes, runAnimation, batchDraw };
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.effects = [];
  vi.clearAllMocks();
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('entrance animation completion and interruption', () => {
  it('restores every image when the completion timer beats animation frames', () => {
    const { nodes, runAnimation, batchDraw } = AnimationHarness();
    runAnimation();
    expect(nodes.map(node => node.opacity())).toEqual([0, 0, 0]);
    vi.advanceTimersByTime(1000);
    expect(nodes.map(node => node.opacity())).toEqual([1, 0.4, 1]);
    expect(nodes.map(node => node.y())).toEqual([0, 100, 200]);
    expect(harness.setPhase).toHaveBeenCalledWith('complete');
    expect(batchDraw).toHaveBeenCalledTimes(2);
  });

  it('restores pending staggered nodes on cancellation and subsequent restart', () => {
    const { nodes, runAnimation } = AnimationHarness();
    const cancel = runAnimation();
    vi.advanceTimersByTime(1); // Only the first staggered tween has started.
    if (typeof cancel === 'function') cancel();
    expect(harness.destroy).toHaveBeenCalledTimes(1);
    expect(nodes.map(node => node.opacity())).toEqual([1, 0.4, 1]);
    runAnimation();
    vi.advanceTimersByTime(1000);
    expect(nodes.map(node => node.opacity())).toEqual([1, 0.4, 1]);
    expect(nodes.map(node => node.y())).toEqual([0, 100, 200]);
  });
});
