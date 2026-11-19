import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TextElement } from '../../types/template';
import { konvaFontStyle, textFontSpec } from '../../utils/textFont';

interface InlineTextEditorProps {
  element: TextElement;
  // Artboard scale and the stage position of the artboard origin, so the
  // editor sits exactly on the text it replaces and follows zoom and pan.
  scale: number;
  originX: number;
  originY: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

// Room for the caret after the last character, as a share of the font size.
const CARET_ALLOWANCE = 0.12;

let measureContext: CanvasRenderingContext2D | null = null;

// Width of the widest line in canvas units, measured the way the canvas text
// node measures it (glyph advance plus letter spacing after every character).
function measureTextWidth(element: TextElement, text: string): number {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return element.fontSize * Math.max(1, text.length) * 0.6;

  measureContext.font = textFontSpec(element);
  const letterSpacing = element.letterSpacing ?? 0;
  return Math.max(
    0,
    ...text.split('\n').map((line) => measureContext!.measureText(line).width + letterSpacing * [...line].length),
  );
}

// DOM text field laid over a canvas text element while it is being edited.
// Rendered from element data, not from the canvas node, so it stays aligned
// through zoom, pan and re-renders.
export function InlineTextEditor({ element, scale, originX, originY, onCommit, onCancel }: InlineTextEditorProps) {
  const [value, setValue] = useState(element.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 'open' until the edit is resolved one way or the other, so blur caused by
  // our own unmount cannot commit twice or resurrect a cancelled edit.
  const outcomeRef = useRef<'open' | 'committed' | 'cancelled'>('open');
  const valueRef = useRef(value);
  const commitRef = useRef(onCommit);

  useLayoutEffect(() => {
    valueRef.current = value;
    commitRef.current = onCommit;
  });

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    textarea.select();
  }, []);

  // Leaving the editor by any other route (the canvas unmounting on
  // navigation) must not drop what was typed. The check is deferred so the
  // effect replay React performs in development is not mistaken for an unmount.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (mountedRef.current || outcomeRef.current !== 'open') return;
        outcomeRef.current = 'committed';
        commitRef.current(valueRef.current);
      });
    };
  }, []);

  const commit = () => {
    if (outcomeRef.current !== 'open') return;
    outcomeRef.current = 'committed';
    onCommit(value);
  };

  const cancel = () => {
    if (outcomeRef.current !== 'open') return;
    outcomeRef.current = 'cancelled';
    onCancel();
  };

  const fontSize = element.fontSize * scale;
  const lineHeight = element.lineHeight ?? 1;
  const lineCount = value.split('\n').length;
  const width = (measureTextWidth(element, value) + element.fontSize * CARET_ALLOWANCE) * scale;
  const fontStyle = konvaFontStyle(element.fontWeight);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        // Keys belong to the IME while it is composing (Escape cancels the
        // candidate, Enter confirms it).
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      }}
      // The pointer is editing text here, not panning or selecting on the canvas.
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      data-editor-inline-text=""
      className="absolute z-30 m-0 resize-none overflow-hidden whitespace-pre border-0 bg-transparent p-0"
      style={{
        // Inline so the frame keeps the selection color whatever the text
        // color is (the site-wide focus ring follows currentColor).
        outline: '2px solid #4F46E5',
        outlineOffset: 2,
        left: originX + element.x * scale,
        top: originY + element.y * scale,
        width: Math.max(width, fontSize * 0.5),
        height: Math.max(1, lineCount) * fontSize * lineHeight,
        transform: `rotate(${element.rotation || 0}deg)`,
        transformOrigin: 'top left',
        fontSize,
        fontFamily: element.fontFamily,
        fontWeight: fontStyle === 'bold' ? 700 : fontStyle === 'lighter' ? 'lighter' : 400,
        letterSpacing: (element.letterSpacing ?? 0) * scale,
        lineHeight,
        textAlign: element.align ?? 'left',
        color: element.fillEnabled ? element.fill : element.stroke,
        caretColor: element.fillEnabled ? element.fill : element.stroke,
      }}
    />
  );
}
