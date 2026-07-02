import { useState, useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import type { CanvasElement } from '../types/template';
import type { CanvasRef } from '../components/Canvas';

export type AnimationPhase = 'idle' | 'loading' | 'animating' | 'complete';

interface UseEntranceAnimationProps {
  elements: CanvasElement[];
  canvasRef: React.RefObject<CanvasRef | null>;
  imageLoadStatus: Map<string, 'loaded' | 'error'>;
  totalImageCount: number;
  enabled: boolean;
}

const TIMEOUT_MS = 5000;
const STAGGER_MS = 80;
const TWEEN_DURATION_S = 0.3;
const Y_OFFSET = 20;

export function useEntranceAnimation({
  elements,
  canvasRef,
  imageLoadStatus,
  totalImageCount,
  enabled,
}: UseEntranceAnimationProps) {
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const tweensRef = useRef<Konva.Tween[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasStartedRef = useRef(false);

  // Cleanup all tweens and timers
  const cleanup = useCallback(() => {
    tweensRef.current.forEach(t => t.destroy());
    tweensRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    animationTimeoutsRef.current.forEach(t => clearTimeout(t));
    animationTimeoutsRef.current = [];
  }, []);

  // Transition to loading when enabled and elements exist
  useEffect(() => {
    if (!enabled || elements.length === 0) {
      if (!enabled) setPhase('idle');
      return;
    }

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    setPhase('loading');

    // Start timeout fallback
    timeoutRef.current = setTimeout(() => {
      setPhase(prev => (prev === 'loading' ? 'animating' : prev));
    }, TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, elements.length]);

  // Check if all images are loaded
  useEffect(() => {
    if (phase !== 'loading') return;

    // No images — go straight to animating
    if (totalImageCount === 0) {
      setPhase('animating');
      return;
    }

    // All images reported
    if (imageLoadStatus.size >= totalImageCount) {
      setPhase('animating');
    }
  }, [phase, imageLoadStatus, totalImageCount]);

  // Run entrance animation
  useEffect(() => {
    if (phase !== 'animating') return;

    const nodesMap = canvasRef.current?.getNodesMap();
    if (!nodesMap || nodesMap.size === 0) {
      // Nodes not ready yet — wait a frame
      const rafId = requestAnimationFrame(() => {
        setPhase(prev => (prev === 'animating' ? 'animating' : prev));
      });
      return () => cancelAnimationFrame(rafId);
    }

    // Filter visible elements and sort by Y position (top to bottom)
    const sorted = [...elements]
      .filter(el => (el.visible ?? true))
      .sort((a, b) => a.y - b.y);

    if (sorted.length === 0) {
      setPhase('complete');
      return;
    }

    // Store original Y positions before modifying
    const originalPositions = new Map<string, { y: number; opacity: number }>();

    // Set all nodes to invisible initial state
    sorted.forEach(el => {
      const node = nodesMap.get(el.id);
      if (!node) return;

      originalPositions.set(el.id, {
        y: node.y(),
        opacity: node.opacity(),
      });

      node.opacity(0);
      node.y(node.y() + Y_OFFSET);
    });

    // Force redraw
    const layer = canvasRef.current?.getLayerNode();
    layer?.batchDraw();

    // Stagger tweens
    sorted.forEach((el, index) => {
      const node = nodesMap.get(el.id);
      const original = originalPositions.get(el.id);
      if (!node || !original) return;

      const t = setTimeout(() => {
        const tween = new Konva.Tween({
          node,
          duration: TWEEN_DURATION_S,
          opacity: original.opacity,
          y: original.y,
          easing: Konva.Easings.EaseOut,
        });
        tween.play();
        tweensRef.current.push(tween);
      }, index * STAGGER_MS);

      animationTimeoutsRef.current.push(t);
    });

    // Transition to complete after all tweens finish
    const totalDuration = (sorted.length - 1) * STAGGER_MS + TWEEN_DURATION_S * 1000 + 50;
    const completeTimeout = setTimeout(() => {
      setPhase('complete');
      cleanup();
    }, totalDuration);

    animationTimeoutsRef.current.push(completeTimeout);

    return () => {
      cleanup();
    };
  }, [phase, elements, canvasRef, cleanup]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      hasStartedRef.current = false;
      cleanup();
    }
  }, [enabled, cleanup]);

  return { phase };
}
