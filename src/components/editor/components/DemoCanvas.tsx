import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas, BLEED } from './Canvas';
import type { CanvasRef } from './Canvas';
import type { Template, CanvasElement } from '../types/template';
import { exportImageFromDataUrl } from '../utils/exportImage';

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const ANIMATE_TARGETS = [
  { id: 'default-text', dx: 50, dy: -25 },
  { id: 'image-1766582681522-0.628893595817318', dx: -35, dy: 30 },
  { id: 'image-1766582786263-0.9803562303447114', dx: 40, dy: -20 },
  { id: 'image-1766582804530-0.15343167122973567', dx: -30, dy: 35 },
];

const DEMO_TEMPLATE: Template = {
  id: 'demo-template',
  name: 'Demo',
  width: 1920,
  height: 1080,
  backgroundColor: '#FFFFFF',
};

const INITIAL_ELEMENTS: CanvasElement[] = [
  {
    x: 0,
    y: -1362.1487118100242,
    id: 'image-1763891627672',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/default-images/1763891281899-bg.jpg',
    type: 'image',
    width: 1937.6149003931453,
    height: 3444.6487118100367,
    locked: true,
    visible: true,
    rotation: 0,
  },
  {
    x: 36.251969508674186,
    y: 829.8737969486174,
    id: 'default-text',
    fill: '#000000',
    text: 'WAHTIF EXPERIMENT',
    type: 'text',
    locked: false,
    stroke: '#000000',
    visible: true,
    fontSize: 245.69268033780253,
    rotation: 0,
    fontFamily: '"Anton SC", sans-serif',
    fontWeight: 900,
    fillEnabled: true,
    strokeWidth: 2,
    letterSpacing: 0,
    strokeEnabled: false,
  },
  {
    x: 51.00329680944341,
    y: -269.0275179087938,
    id: 'image-1766582819790-0.5593207013341895',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/user-images/9c1674eb-f053-4fe5-b99a-70805d2ccc59/migrated/f63f6921bbc459dc68fb6fdcaa5966e5baa7786183bd6d0145abd0e44a856c84.png',
    type: 'image',
    width: 1768.7788669352533,
    height: 1310.2603091407161,
    visible: true,
    rotation: 0,
  },
  {
    x: 708.75,
    y: -16.273862713347857,
    id: 'image-1766582681522-0.628893595817318',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/user-images/9c1674eb-f053-4fe5-b99a-70805d2ccc59/migrated/31173ef5ae46df68867b7ff6939971bd480d0cfac7083a3bc017cad72da35a1a.png',
    type: 'image',
    width: 357.8632744666505,
    height: 263.27386271335087,
    visible: true,
    rotation: 0,
  },
  {
    x: 215.75000000000003,
    y: 325,
    id: 'image-1766582744294-0.9578916601220744',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/user-images/9c1674eb-f053-4fe5-b99a-70805d2ccc59/migrated/c1a500b362163fb19ba61b9c2744d16158ea1aaea3cf309a53a5938bf7c558ec.png',
    type: 'image',
    width: 138,
    height: 147,
    visible: true,
  },
  {
    x: 1232.0653530070351,
    y: 497.50000000000006,
    id: 'image-1766582759228-0.13132096291841278',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/user-images/9c1674eb-f053-4fe5-b99a-70805d2ccc59/migrated/90babdb2cbc8f5d123058eb04f88859c953b9fabd1bfc4a58612e2eb7fc3d7f0.png',
    type: 'image',
    width: 768.0669709834286,
    height: 801.909002271971,
    visible: true,
    rotation: 0,
  },
  {
    x: 62.14173212465808,
    y: 683.7500000000011,
    id: 'image-1766582786263-0.9803562303447114',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/user-images/9c1674eb-f053-4fe5-b99a-70805d2ccc59/migrated/a81d1402b36a5996e054f4a20ff8be6368addab8d12acba591f197787ddf3985.png',
    type: 'image',
    width: 280.60826787534216,
    height: 280.6082678753424,
    visible: true,
    rotation: 0,
  },
  {
    x: 1608.7500000000002,
    y: 145.00000000000003,
    id: 'image-1766582804530-0.15343167122973567',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/user-images/9c1674eb-f053-4fe5-b99a-70805d2ccc59/migrated/b3244f73964f815e9e9a68d40d081c71d569d5399d4d45fcc094408af0548076.png',
    type: 'image',
    width: 300,
    height: 341,
    visible: true,
  },
  {
    x: 832.7500000000003,
    y: 860.5000000000002,
    id: 'image-1766582819791-0.14797146051348375',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/user-images/9c1674eb-f053-4fe5-b99a-70805d2ccc59/migrated/d526d16d964fe5ca84e53a7135f95c6bfe28a9998486f8539f744b44e54a89a1.png',
    type: 'image',
    width: 154,
    height: 243,
    visible: true,
  },
  {
    x: -15.625000000000002,
    y: -20,
    id: 'image-1766583108574-0.7473750764430017',
    src: 'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/user-images/9c1674eb-f053-4fe5-b99a-70805d2ccc59/migrated/f265835a177efe4ff4b044a54a423092453be31fa8f9927d446489639867255c.png',
    type: 'image',
    width: 1219,
    height: 1920,
    locked: true,
    visible: true,
  },
];

interface DemoCanvasProps {
  scale?: number;
}

export const DemoCanvas = ({ scale = 0.45 }: DemoCanvasProps) => {
  const { t } = useTranslation(['common', 'message']);
  const [elements, setElements] = useState<CanvasElement[]>(INITIAL_ELEMENTS);
  const [selectedIds, setSelectedIds] = useState<string[]>(['default-text']);
  const canvasRef = useRef<CanvasRef>(null);
  const autoAnimatingRef = useRef(true);
  const animFrameRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stopAutoAnimation = useCallback(() => {
    autoAnimatingRef.current = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const animateElement = useCallback((targetIndex: number) => {
    if (!autoAnimatingRef.current) return;

    const target = ANIMATE_TARGETS[targetIndex % ANIMATE_TARGETS.length];
    setSelectedIds([target.id]);

    const duration = 1500;
    let originX: number | null = null;
    let originY: number | null = null;

    timeoutRef.current = setTimeout(() => {
      if (!autoAnimatingRef.current) return;
      const startTime = performance.now();

      const tick = (now: number) => {
        if (!autoAnimatingRef.current) return;

        const progress = Math.min((now - startTime) / duration, 1);
        const eased = easeInOutCubic(progress);

        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== target.id) return el;
            if (originX === null) {
              originX = el.x;
              originY = el.y;
            }
            return {
              ...el,
              x: originX + target.dx * eased,
              y: (originY ?? el.y) + target.dy * eased,
            } as CanvasElement;
          })
        );

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          timeoutRef.current = setTimeout(() => {
            animateElement(targetIndex + 1);
          }, 500);
        }
      };

      animFrameRef.current = requestAnimationFrame(tick);
    }, 300);
  }, []);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => animateElement(0), 1500);
    return () => stopAutoAnimation();
  }, [animateElement, stopAutoAnimation]);

  const handleUserSelect = useCallback(
    (ids: string[]) => {
      stopAutoAnimation();
      setSelectedIds(ids);
    },
    [stopAutoAnimation]
  );

  const handleElementUpdate = (id: string, updates: Partial<CanvasElement>) => {
    stopAutoAnimation();
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } as CanvasElement : el))
    );
  };

  const handleElementsUpdate = (
    ids: string[],
    updateFn: (el: CanvasElement) => Partial<CanvasElement>
  ) => {
    stopAutoAnimation();
    setElements((prev) =>
      prev.map((el) => (ids.includes(el.id) ? { ...el, ...updateFn(el) } as CanvasElement : el))
    );
  };

  const handleTextChange = (id: string, newText: string) => {
    stopAutoAnimation();
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, text: newText } as CanvasElement : el))
    );
  };

  const handleExport = async () => {
    if (!canvasRef.current) return;
    const dataURL = canvasRef.current.exportImage();
    if (!dataURL || dataURL.length < 100) {
      alert(t('message:error.imageGenerationFailed'));
      return;
    }

    try {
      const exportResult = await exportImageFromDataUrl(dataURL, 'whatif-demo.png');
      if (exportResult.isIOS && exportResult.method !== 'share-files') {
        alert(t('message:info.saveImageGuide'));
      }
      if (exportResult.inAppBrowser) {
        alert(t('message:info.inAppBrowserGuide'));
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      alert(t('message:error.exportFailed'));
    }
  };

  const bleedPx = BLEED * scale;
  const artboardWidth = DEMO_TEMPLATE.width * scale;
  const artboardHeight = DEMO_TEMPLATE.height * scale;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative inline-block">
        <div
          className="overflow-hidden rounded-2xl shadow-2xl shadow-black/40"
          style={{ width: artboardWidth, height: artboardHeight }}
        >
          <div style={{ marginLeft: -bleedPx, marginTop: -bleedPx }}>
            <Canvas
              ref={canvasRef}
              template={DEMO_TEMPLATE}
              elements={elements}
              selectedElementIds={selectedIds}
              canvasColor="#FFFFFF"
              scale={scale}
              onSelectElement={handleUserSelect}
              onElementUpdate={handleElementUpdate}
              onElementsUpdate={handleElementsUpdate}
              onTextChange={handleTextChange}
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          className="hidden md:flex absolute bottom-4 right-4 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all font-medium text-sm items-center gap-2 shadow-lg"
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          {t('hero.downloadButton')}
        </button>
      </div>

      <button
        onClick={handleExport}
        className="md:hidden px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all font-medium text-sm flex items-center gap-2 shadow-lg"
      >
        <span className="material-symbols-outlined text-[20px]">download</span>
        {t('hero.downloadButton')}
      </button>
    </div>
  );
};
