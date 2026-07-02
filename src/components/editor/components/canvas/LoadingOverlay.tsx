import { useEffect, useState } from 'react';
import type { CanvasElement, TextElement, ShapeElement, ImageElement, Template } from '../../types/template';
import type { AnimationPhase } from '../../hooks/useEntranceAnimation';

interface LoadingOverlayProps {
  elements: CanvasElement[];
  template: Template;
  scale: number;
  phase: AnimationPhase;
  canvasColor: string;
}

const BLEED = 200;

function getElementBounds(el: CanvasElement): { x: number; y: number; width: number; height: number } {
  if (el.type === 'shape') {
    const shape = el as ShapeElement;
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  if (el.type === 'image') {
    const img = el as ImageElement;
    return { x: img.x, y: img.y, width: img.width, height: img.height };
  }
  // Text — estimate dimensions from font size and text length
  const text = el as TextElement;
  const estimatedWidth = Math.min(text.fontSize * text.text.length * 0.55, 800);
  const estimatedHeight = text.fontSize * (text.lineHeight ?? 1.2);
  return { x: text.x, y: text.y, width: estimatedWidth, height: estimatedHeight };
}

export function LoadingOverlay({ elements, template, scale, phase, canvasColor }: LoadingOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (phase === 'animating') {
      setIsFadingOut(true);
      const timer = setTimeout(() => setIsVisible(false), 400);
      return () => clearTimeout(timer);
    }
    if (phase === 'complete') {
      setIsVisible(false);
    }
  }, [phase]);

  if (!isVisible) return null;

  const stageWidth = (template.width + BLEED * 2) * scale;
  const stageHeight = (template.height + BLEED * 2) * scale;

  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none"
      style={{
        width: stageWidth,
        height: stageHeight,
        transition: isFadingOut ? 'opacity 400ms ease-out' : undefined,
        opacity: isFadingOut ? 0 : 1,
      }}
    >
      {/* Dark background matching editor bg */}
      <div className="absolute inset-0 bg-[#101010]" />

      {/* Canvas area with skeleton wireframes */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: BLEED * scale,
          top: BLEED * scale,
          width: template.width * scale,
          height: template.height * scale,
          background: canvasColor,
        }}
      >
        {/* Skeleton placeholders for each element */}
        {elements
          .filter(el => el.visible ?? true)
          .map(el => {
            const bounds = getElementBounds(el);
            return (
              <div
                key={el.id}
                className="absolute rounded animate-pulse"
                style={{
                  left: bounds.x * scale,
                  top: bounds.y * scale,
                  width: bounds.width * scale,
                  height: bounds.height * scale,
                  backgroundColor: 'rgba(156, 163, 175, 0.2)',
                }}
              />
            );
          })}

        {/* Loading indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
            </div>
            <span className="text-xs text-gray-400 font-medium tracking-wider uppercase">
              Loading...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
