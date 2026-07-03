import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * ============================================================
 * HOW TO ADD NEW FONTS
 * ============================================================
 *
 * 1. Add the font to index.html (Google Fonts link):
 *    - Go to https://fonts.google.com/ and find the font
 *    - Add it to the existing Google Fonts URL in index.html
 *    - Example: &family=NewFontName:wght@400;700
 *
 * 2. Add the font to FONT_CATEGORIES below:
 *    - Choose the appropriate category (latinSans, latinSerif, japaneseSans, japaneseSerif)
 *    - Add an object with:
 *      - name: Display name shown in the dropdown
 *      - value: CSS font-family value (use quotes for multi-word names)
 *      - googleName: The font name as it appears in Google Fonts URL (spaces replaced with +)
 *
 * 3. Example for adding "Roboto":
 *    index.html: &family=Roboto:wght@100..900
 *    FONT_CATEGORIES (latinSans):
 *      { name: 'Roboto', value: '"Roboto", sans-serif', googleName: 'Roboto' }
 *
 * ============================================================
 */

// Preview text for each font category
const LATIN_PREVIEW_TEXT = 'ABC123';
const JAPANESE_PREVIEW_TEXT = 'あいう漢字';

// Font categories with preview support
// googleName is used for Google Fonts API text parameter
const FONT_CATEGORIES = [
  {
    categoryKey: 'latinSans',
    previewText: LATIN_PREVIEW_TEXT,
    fonts: [
      { name: 'Arial', value: 'Arial', googleName: null }, // System font, no Google Fonts
      { name: 'Bebas Neue', value: '"Bebas Neue", sans-serif', googleName: 'Bebas+Neue' },
      { name: 'Anton SC', value: '"Anton SC", sans-serif', googleName: 'Anton+SC' },
      { name: 'Josefin Sans', value: '"Josefin Sans", sans-serif', googleName: 'Josefin+Sans' },
      { name: 'Special Gothic Expanded One', value: '"Special Gothic Expanded One", sans-serif', googleName: 'Special+Gothic+Expanded+One' },
      { name: 'Six Caps', value: '"Six Caps", sans-serif', googleName: 'Six+Caps' },
      { name: 'Bytesized', value: '"Bytesized", sans-serif', googleName: 'Bytesized' },
    ]
  },
  {
    categoryKey: 'latinSerif',
    previewText: LATIN_PREVIEW_TEXT,
    fonts: [
      { name: 'Georgia', value: 'Georgia', googleName: null }, // System font
    ]
  },
  {
    categoryKey: 'japaneseSans',
    previewText: JAPANESE_PREVIEW_TEXT,
    fonts: [
      { name: 'Noto Sans JP', value: '"Noto Sans JP", sans-serif', googleName: 'Noto+Sans+JP' },
      { name: '游ゴシック', value: '"Yu Gothic", "游ゴシック", YuGothic, sans-serif', googleName: null }, // System font
      { name: 'WDXL Lubrifont JP N', value: '"WDXL Lubrifont JP N", sans-serif', googleName: 'WDXL+Lubrifont+JP+N' },
      { name: 'DotGothic16', value: '"DotGothic16", sans-serif', googleName: 'DotGothic16' },
    ]
  },
  {
    categoryKey: 'japaneseSerif',
    previewText: JAPANESE_PREVIEW_TEXT,
    fonts: [
      { name: 'Noto Serif JP', value: '"Noto Serif JP", serif', googleName: 'Noto+Serif+JP' },
    ]
  },
];

// Get all fonts in a flat array for easier lookup
const ALL_FONTS = FONT_CATEGORIES.flatMap(cat =>
  cat.fonts.map(font => ({ ...font, previewText: cat.previewText }))
);

interface FontSelectorProps {
  selectedFont: string;
  onFontChange: (font: string) => void;
}

export const FontSelector = ({ selectedFont, onFontChange }: FontSelectorProps) => {
  const { t } = useTranslation('editor');
  const [isOpen, setIsOpen] = useState(false);
  const [previewStylesLoaded, setPreviewStylesLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Find current font info
  const currentFont = ALL_FONTS.find(f => f.value === selectedFont) || { name: selectedFont, previewText: LATIN_PREVIEW_TEXT };

  // Load preview fonts when dropdown opens
  useEffect(() => {
    if (isOpen && !previewStylesLoaded) {
      loadPreviewFonts();
      setPreviewStylesLoaded(true);
    }
  }, [isOpen, previewStylesLoaded]);

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

  // Load lightweight font subsets for preview
  const loadPreviewFonts = () => {
    const googleFonts = ALL_FONTS.filter(f => f.googleName);

    // Group fonts by preview text to minimize requests
    const latinFonts = googleFonts.filter(f => f.previewText === LATIN_PREVIEW_TEXT);
    const japaneseFonts = googleFonts.filter(f => f.previewText === JAPANESE_PREVIEW_TEXT);

    // Create and inject style elements for preview fonts
    if (latinFonts.length > 0) {
      const latinFamilies = latinFonts.map(f => `family=${f.googleName}`).join('&');
      const latinUrl = `https://fonts.googleapis.com/css2?${latinFamilies}&text=${encodeURIComponent(LATIN_PREVIEW_TEXT)}&display=swap`;
      injectFontStyle(latinUrl, 'font-preview-latin');
    }

    if (japaneseFonts.length > 0) {
      const japaneseFamilies = japaneseFonts.map(f => `family=${f.googleName}`).join('&');
      const japaneseUrl = `https://fonts.googleapis.com/css2?${japaneseFamilies}&text=${encodeURIComponent(JAPANESE_PREVIEW_TEXT)}&display=swap`;
      injectFontStyle(japaneseUrl, 'font-preview-japanese');
    }
  };

  const injectFontStyle = (url: string, id: string) => {
    // Don't inject if already exists
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  };

  const handleFontSelect = (fontValue: string) => {
    onFontChange(fontValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#2b2b2b] border border-[#444444] rounded-lg text-xs text-gray-100 hover:bg-[#333333] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
      >
        <span
          className="truncate text-sm"
          style={{ fontFamily: selectedFont }}
        >
          {currentFont.name}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 max-h-96 overflow-y-auto bg-[#1a1a1a] border border-[#444444] rounded-lg shadow-2xl">
          {FONT_CATEGORIES.map((category) => (
            <div key={category.categoryKey}>
              {/* Category Header */}
              <div className="sticky top-0 px-3 py-2 bg-[#252525] border-b border-[#333333]">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {t(`properties.fontCategories.${category.categoryKey}`)}
                </span>
              </div>

              {/* Font Options */}
              {category.fonts.map((font) => {
                const isSelected = font.value === selectedFont;
                return (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => handleFontSelect(font.value)}
                    className={`w-full text-left px-3 py-3 hover:bg-[#333333] transition-colors ${
                      isSelected ? 'bg-indigo-600/20 border-l-2 border-indigo-500' : ''
                    }`}
                  >
                    {/* Font Name */}
                    <div className="text-xs text-gray-400 mb-1">
                      {font.name}
                    </div>
                    {/* Font Preview */}
                    <div
                      className="text-2xl text-gray-100 leading-tight"
                      style={{ fontFamily: font.value }}
                    >
                      {category.previewText}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Export font list for use in other components
export { FONT_CATEGORIES, ALL_FONTS };
