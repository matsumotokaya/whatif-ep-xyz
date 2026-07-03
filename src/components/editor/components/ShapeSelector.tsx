import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type ShapeType = 'rectangle' | 'triangle' | 'star' | 'circle' | 'heart';

interface ShapeSelectorProps {
  onAddShape: (shapeType: ShapeType) => void;
}

const SHAPES: { type: ShapeType; icon: string }[] = [
  { type: 'rectangle', icon: 'rectangle' },
  { type: 'circle', icon: 'circle' },
  { type: 'triangle', icon: 'change_history' },
  { type: 'star', icon: 'star' },
  { type: 'heart', icon: 'favorite' },
];

export const ShapeSelector = ({ onAddShape }: ShapeSelectorProps) => {
  const { t } = useTranslation('editor');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleShapeSelect = (shapeType: ShapeType) => {
    onAddShape(shapeType);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${
          isOpen
            ? 'bg-indigo-600 text-white'
            : 'text-gray-300 bg-[#333333] hover:bg-[#444444]'
        }`}
        title={t('object.addShape')}
      >
        <span className="material-symbols-outlined text-[16px]">category</span>
        <span>{t('object.addShape')}</span>
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform ml-1 ${isOpen ? 'rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-48 bg-[#1a1a1a] border border-[#444444] rounded-lg shadow-2xl overflow-hidden">
          {SHAPES.map((shape) => (
            <button
              key={shape.type}
              type="button"
              onClick={() => handleShapeSelect(shape.type)}
              className="w-full text-left px-3 py-2.5 hover:bg-[#333333] transition-colors flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-[20px] text-gray-400">
                {shape.icon}
              </span>
              <span className="text-sm text-gray-200">
                {t(`shapes.${shape.type}`)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
