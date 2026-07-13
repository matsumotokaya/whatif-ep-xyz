import { useTranslation } from 'react-i18next';
import type { CanvasElement } from '../types/template';
import { ColorSelector } from '../components/ColorSelector';
import { StoriesSheet } from './StoriesSheet';

// Stories effects tool (E3).
//
// Applies opacity / blur / drop-shadow to the single selected (unlocked)
// element. Every control is wired to the exact same BannerEditor handlers the
// desktop PropertyPanel uses (updateSelectedElementsTransient during a drag,
// commitInteraction on release) so there is no new mutation logic — this is a
// thumb-friendly presentation of the existing effect commands. Slider ranges
// mirror PropertyPanel so the two views stay in sync. Image blur only appears
// for image elements (it is a no-op on text/shape, matching the desktop panel).
interface StoriesEffectsSheetProps {
  element: CanvasElement;
  onOpacityChange: (opacity: number) => void;
  onImageBlurChange: (blur: number) => void;
  onShadowEnabledChange: (enabled: boolean) => void;
  onShadowColorChange: (color: string) => void;
  onShadowBlurChange: (blur: number) => void;
  onShadowOffsetXChange: (offset: number) => void;
  onShadowOffsetYChange: (offset: number) => void;
  onShadowOpacityChange: (opacity: number) => void;
  // Commits the transient interaction as a single undo entry (release / blur).
  onInteractionEnd: () => void;
  onClose: () => void;
}

interface EffectSliderProps {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit: () => void;
}

// Larger touch target than the desktop panel's 1.5px track.
const EffectSlider = ({ label, display, value, min, max, step = 1, onChange, onCommit }: EffectSliderProps) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-xs font-medium text-gray-300">{label}</label>
      <span className="text-xs font-medium text-gray-400">{display}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerUp={onCommit}
      onPointerCancel={onCommit}
      onBlur={onCommit}
      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#444444] py-2 accent-indigo-500"
    />
  </div>
);

export const StoriesEffectsSheet = ({
  element,
  onOpacityChange,
  onImageBlurChange,
  onShadowEnabledChange,
  onShadowColorChange,
  onShadowBlurChange,
  onShadowOffsetXChange,
  onShadowOffsetYChange,
  onShadowOpacityChange,
  onInteractionEnd,
  onClose,
}: StoriesEffectsSheetProps) => {
  const { t } = useTranslation('editor');

  const opacityPct = Math.round((element.opacity ?? 1) * 100);
  const shadowEnabled = element.shadowEnabled ?? false;
  const shadowBlur = element.shadowBlur ?? 4;
  const shadowOffsetX = element.shadowOffsetX ?? 2;
  const shadowOffsetY = element.shadowOffsetY ?? 2;
  const shadowOpacityPct = Math.round((element.shadowOpacity ?? 0.5) * 100);
  const blur = element.type === 'image' ? element.blurRadius ?? 0 : 0;

  return (
    <StoriesSheet title={t('stories.effects')} onClose={onClose}>
      <div className="space-y-5">
        <EffectSlider
          label={t('properties.opacity')}
          display={`${opacityPct}%`}
          value={opacityPct}
          min={0}
          max={100}
          onChange={(value) => onOpacityChange(value / 100)}
          onCommit={onInteractionEnd}
        />

        {element.type === 'image' && (
          <EffectSlider
            label={t('properties.imageBlur')}
            display={`${blur}px`}
            value={blur}
            min={0}
            max={100}
            onChange={onImageBlurChange}
            onCommit={onInteractionEnd}
          />
        )}

        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-200">{t('properties.shadow')}</label>
            <button
              type="button"
              role="switch"
              aria-checked={shadowEnabled}
              onClick={() => onShadowEnabledChange(!shadowEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                shadowEnabled ? 'bg-indigo-500' : 'bg-[#444444]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  shadowEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {shadowEnabled && (
            <div className="mt-3 space-y-4 rounded-lg bg-white/5 p-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-300">
                  {t('stories.shadowColor')}
                </label>
                <ColorSelector
                  selectedColor={element.shadowColor ?? '#000000'}
                  onColorChange={onShadowColorChange}
                  showInput={false}
                  onInteractionEnd={onInteractionEnd}
                />
              </div>
              <EffectSlider
                label={t('properties.shadowBlur')}
                display={`${shadowBlur}px`}
                value={shadowBlur}
                min={0}
                max={50}
                onChange={onShadowBlurChange}
                onCommit={onInteractionEnd}
              />
              <EffectSlider
                label={t('properties.shadowOffsetX')}
                display={`${shadowOffsetX}px`}
                value={shadowOffsetX}
                min={-50}
                max={50}
                onChange={onShadowOffsetXChange}
                onCommit={onInteractionEnd}
              />
              <EffectSlider
                label={t('properties.shadowOffsetY')}
                display={`${shadowOffsetY}px`}
                value={shadowOffsetY}
                min={-50}
                max={50}
                onChange={onShadowOffsetYChange}
                onCommit={onInteractionEnd}
              />
              <EffectSlider
                label={t('properties.shadowOpacity')}
                display={`${shadowOpacityPct}%`}
                value={shadowOpacityPct}
                min={0}
                max={100}
                onChange={(value) => onShadowOpacityChange(value / 100)}
                onCommit={onInteractionEnd}
              />
            </div>
          )}
        </div>
      </div>
    </StoriesSheet>
  );
};
