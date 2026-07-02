import { ALL_SIZE_PRESETS, type SizeCategory } from '../utils/sizeCategories';

interface SizePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (width: number, height: number) => void;
  currentWidth: number;
  currentHeight: number;
}

export const SizePresetModal = ({
  isOpen,
  onClose,
  onSelect,
  currentWidth,
  currentHeight,
}: SizePresetModalProps) => {
  if (!isOpen) return null;

  const handleSelect = (preset: SizeCategory) => {
    onSelect(preset.width, preset.height);
    onClose();
  };

  const isSelected = (preset: SizeCategory) =>
    currentWidth === preset.width && currentHeight === preset.height;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <h2 className="text-base font-semibold text-gray-100">All Sizes</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {ALL_SIZE_PRESETS.map((group) => (
            <div key={group.groupKey}>
              {/* Group label */}
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {group.groupLabel}
              </h3>

              {/* Preset buttons */}
              <div className="flex flex-col gap-1">
                {group.presets.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => handleSelect(preset)}
                    className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors text-left ${
                      isSelected(preset)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]'
                    }`}
                  >
                    <span className="font-mono">
                      {preset.width}×{preset.height}
                    </span>
                    <span className="mx-2 opacity-40">|</span>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
