import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ko', label: '한국어' },
];

interface LanguageSwitcherProps {
  dropUp?: boolean;
}

export const LanguageSwitcher = ({ dropUp = false }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: Event) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
    // Save to localStorage
    localStorage.setItem('banalist_language', langCode);
  };

  // Match language code: try exact match first (zh-CN, zh-TW), then base code (en-US -> en)
  const detectedLang = i18n.language;
  const currentLang = LANGUAGES.find(lang => lang.code === detectedLang)
    || LANGUAGES.find(lang => lang.code === detectedLang.split('-')[0])
    || LANGUAGES[0];

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 md:px-2.5 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" />
          <ellipse cx="12" cy="12" rx="4" ry="10" />
          <path d="M2 12h20" />
          <path d="M4.5 7h15" />
          <path d="M4.5 17h15" />
        </svg>
        <span className="text-white text-xs hidden md:inline">{currentLang.label}</span>
        <svg className="w-3 h-3 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dropUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute right-0 w-40 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-[80] ${
          dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full px-4 py-2 text-left text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                currentLang.code === lang.code ? 'bg-indigo-50' : ''
              }`}
            >
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
