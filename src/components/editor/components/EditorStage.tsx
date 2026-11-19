import { Suspense, useRef, useSyncExternalStore, type RefObject } from 'react';
import type { CanvasProps, CanvasRef } from './Canvas';
import { LazyCanvas } from './LazyCanvas';
import { ImageLoadFeedback } from './canvas/ImageLoadFeedback';
import { LoadingOverlay } from './canvas/LoadingOverlay';
import { useViewportInteractions } from '../hooks/useViewportInteractions';
import { selectArtboardOrigin, type ViewportStore } from '../utils/viewportStore';

type StageCanvasProps = Omit<
  CanvasProps,
  'scale' | 'viewport' | 'interactionMode' | 'onBackgroundTouchStart' | 'onBackgroundPanStart'
>;

interface EditorStageProps extends StageCanvasProps {
  viewportStore: ViewportStore;
  canvasRef: RefObject<CanvasRef | null>;
  // Hand tool selected: every drag on the canvas area pans the view.
  panMode: boolean;
  isTransformingRef: RefObject<boolean>;
}

// The Studio canvas area. The Konva stage always matches this area's size;
// zoom and pan only change where the artboard is drawn inside it, so the
// canvas bitmap stays the same size at every zoom level.
export function EditorStage({ viewportStore, canvasRef, panMode, isTransformingRef, ...canvasProps }: EditorStageProps) {
  const containerRef = useRef<HTMLElement>(null);
  const viewport = useSyncExternalStore(viewportStore.subscribe, viewportStore.getState, viewportStore.getState);
  const { isPanning, isSpaceHeld, beginMousePan, beginTouchPan } = useViewportInteractions({
    store: viewportStore,
    containerRef,
    isTransformingRef,
  });

  const { container, view } = viewport;
  const origin = selectArtboardOrigin(viewport);
  const isMeasured = container.width > 0 && container.height > 0;
  const handToolActive = panMode || isSpaceHeld;
  const { template, elements, canvasColor, entranceAnimationPhase, textPlacementMode } = canvasProps;
  const showLoadingOverlay = entranceAnimationPhase === 'loading' || entranceAnimationPhase === 'animating';

  return (
    <main
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-[#151515]"
      style={{
        touchAction: 'none',
        cursor: isPanning ? 'grabbing' : textPlacementMode ? 'text' : 'default',
      }}
      data-artboard-origin-x={origin.x}
      data-artboard-origin-y={origin.y}
      data-artboard-scale={view.scale}
      onMouseDown={(event) => {
        // The middle button pans from anywhere, whatever is under the pointer.
        if (event.button !== 1) return;
        event.preventDefault();
        beginMousePan(event.clientX, event.clientY);
      }}
    >
      {isMeasured && (
        <>
          <Suspense fallback={null}>
            <LazyCanvas
              ref={canvasRef}
              {...canvasProps}
              scale={view.scale}
              viewport={{ width: container.width, height: container.height, originX: origin.x, originY: origin.y }}
              interactionMode="studio"
              onBackgroundTouchStart={beginTouchPan}
              onBackgroundPanStart={beginMousePan}
            />
          </Suspense>
          <ImageLoadFeedback
            elements={elements}
            scale={view.scale}
            width={template.width}
            height={template.height}
            originX={origin.x}
            originY={origin.y}
          />
          {showLoadingOverlay && (
            <LoadingOverlay
              elements={elements}
              template={template}
              scale={view.scale}
              phase={entranceAnimationPhase}
              canvasColor={canvasColor}
              originX={origin.x}
              originY={origin.y}
            />
          )}
          {/* Hand tool (or Space held): this layer takes the pointer so a drag
              pans the view instead of reaching the elements underneath. */}
          {handToolActive && (
            <div
              className="absolute inset-0 z-30"
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                beginMousePan(event.clientX, event.clientY);
              }}
              onTouchStart={(event) => {
                // Two fingers are a pinch-zoom, handled by the canvas area.
                if (event.touches.length !== 1) return;
                beginTouchPan(event.touches[0].clientX, event.touches[0].clientY);
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
