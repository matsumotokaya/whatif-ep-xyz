import { useTranslation } from 'react-i18next';

interface ColorSelectorProps {
  label?: string;
  selectedColor: string;
  onColorChange: (color: string) => void;
  showInput?: boolean;
}

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F59E0B',
  '#22C55E', '#0EA5E9', '#8B5CF6', '#EC4899',
];

export const ColorSelector = ({
  label,
  selectedColor,
  onColorChange,
  showInput = true,
}: ColorSelectorProps) => {
  const { t } = useTranslation('common');
  const colorPickerTitle = t('colorPicker.open');
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      {showInput && (
        <div className="flex items-center gap-1.5 mb-2">
          <div
            className="w-7 h-7 rounded border-2 border-gray-600 shadow-sm flex-shrink-0"
            style={{ backgroundColor: selectedColor }}
          />
          <input
            type="text"
            value={selectedColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 bg-[#2b2b2b] border border-[#444444] rounded text-xs font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="relative flex-shrink-0">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title={colorPickerTitle}
            />
            <button
              type="button"
              className="w-7 h-7 flex items-center justify-center bg-[#333333] hover:bg-[#444444] border border-[#555555] rounded transition-colors"
              title={colorPickerTitle}
            >
              <span className="material-symbols-outlined text-gray-300 text-[16px]">colorize</span>
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={`w-full aspect-square rounded border transition-all hover:scale-105 ${
              selectedColor.toLowerCase() === color.toLowerCase()
                ? 'border-2 border-indigo-500'
                : 'border border-gray-600'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
};
