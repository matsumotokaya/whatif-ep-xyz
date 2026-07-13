import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_FONTS } from '../components/FontSelector';
import { PRESET_COLORS } from '../components/ColorSelector';
import {
  STORY_TEXT_SIZE_KEYS,
  fontSizeForSizeKey,
  nearestSizeKey,
  previewFontSizePx,
  getViewportBox,
  type ViewportBox,
} from './storiesTextTools';

// Stories fullscreen text editing overlay (E2-c).
//
// Instagram-style: a dark translucent overlay (the canvas stays faintly
// visible behind it) with a centered multi-line input, plus a tool block —
// font carousel, color swatches and S/M/L size chips — that must stay
// visible ABOVE the soft keyboard. The overlay tracks `visualViewport`
// (resize + scroll) and sizes itself to the visible box, which is the only
// reliable way to co-exist with the keyboard on iOS Safari, where the
// window itself scrolls when the keyboard opens.
//
// The component is purely local-state; the caller receives the final value
// once on "Done" and commits it through the command layer as a single undo
// entry. Cancel (backdrop tap or the X button) discards everything.

export interface StoriesTextValue {
  text: string;
  fontFamily: string;
  fill: string;
  fontSize: number;
}

interface StoriesTextEditorProps {
  initial: StoriesTextValue;
  onDone: (value: StoriesTextValue) => void;
  onCancel: () => void;
}

export const StoriesTextEditor = ({ initial, onDone, onCancel }: StoriesTextEditorProps) => {
  const { t } = useTranslation('editor');
  const [text, setText] = useState(initial.text);
  const [fontFamily, setFontFamily] = useState(initial.fontFamily);
  const [fill, setFill] = useState(initial.fill);
  const [fontSize, setFontSize] = useState(initial.fontSize);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [viewportBox, setViewportBox] = useState<ViewportBox>(() =>
    typeof window === 'undefined'
      ? { top: 0, height: 0 }
      : getViewportBox(window.visualViewport, window.innerHeight)
  );

  // Follow the visual viewport while the keyboard opens/closes. `scroll`
  // matters on iOS Safari: opening the keyboard can scroll the visual
  // viewport (offsetTop changes) without firing `resize`.
  useEffect(() => {
    const update = () => setViewportBox(getViewportBox(window.visualViewport, window.innerHeight));
    update();
    const vv = window.visualViewport;
    if (!vv) {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // Focus immediately (this mount is always user-gesture initiated, so the
  // keyboard opens) with the caret at the end of any existing text.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);
  }, []);

  const previewPx = previewFontSizePx(fontSize);

  // Auto-grow the textarea with its content, capped so long text never
  // pushes the tool block off screen.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = Math.max(viewportBox.height * 0.45, previewPx * 2);
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [text, previewPx, viewportBox.height]);

  const activeSizeKey = nearestSizeKey(fontSize);

  const handleDone = () => onDone({ text, fontFamily, fill, fontSize });

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Visible box: offset/sized to the visual viewport so the tool block
          sits right above the soft keyboard. */}
      <div
        className="absolute left-0 flex w-full flex-col bg-black/70"
        style={{ top: viewportBox.top, height: viewportBox.height }}
      >
        {/* Top bar: cancel (discard) / done (commit) */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-transform active:scale-95"
            aria-label="Cancel text editing"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="flex h-10 items-center rounded-full bg-white px-5 text-sm font-semibold text-gray-900 transition-transform active:scale-95"
          >
            {t('stories.done')}
          </button>
        </div>

        {/* Input area. Tapping the empty space around the textarea cancels
            (IG behavior); taps on the textarea itself just move the caret. */}
        <div
          className="flex min-h-0 flex-1 items-center justify-center px-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) onCancel();
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('stories.textPlaceholder')}
            rows={1}
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck={false}
            className="w-full resize-none overflow-y-auto bg-transparent text-center outline-none placeholder:text-white/40"
            style={{
              fontFamily,
              color: fill,
              fontSize: `${previewPx}px`,
              lineHeight: 1.2,
              caretColor: '#FFFFFF',
            }}
          />
        </div>

        {/* Tool block pinned above the keyboard: size chips + color swatches,
            then the font carousel. */}
        <div
          className="flex flex-col gap-2 px-3 pt-1"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
          // Keep the textarea focused (and the keyboard open) while tapping
          // tools: preventing mousedown's default stops the focus transfer.
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-black/40 p-1">
              {STORY_TEXT_SIZE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFontSize(fontSizeForSizeKey(key))}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-transform active:scale-95 ${
                    activeSizeKey === key ? 'bg-white text-gray-900' : 'text-white/80'
                  }`}
                  aria-pressed={activeSizeKey === key}
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 [-webkit-overflow-scrolling:touch]">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFill(color)}
                  className={`h-7 w-7 shrink-0 rounded-full border border-white/30 transition-transform active:scale-95 ${
                    fill === color ? 'ring-2 ring-white ring-offset-1 ring-offset-black/70' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Text color ${color}`}
                  aria-pressed={fill === color}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1 [-webkit-overflow-scrolling:touch]">
            {ALL_FONTS.map((font) => (
              <button
                key={font.value}
                type="button"
                onClick={() => setFontFamily(font.value)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-transform active:scale-95 ${
                  fontFamily === font.value
                    ? 'bg-white text-gray-900'
                    : 'bg-black/40 text-white/90'
                }`}
                style={{ fontFamily: font.value }}
                aria-pressed={fontFamily === font.value}
              >
                {font.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
