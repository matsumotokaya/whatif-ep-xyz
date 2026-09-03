import { useState, useRef, useEffect } from 'react';
import { useLanguage, type Language } from '@/context/LanguageContext';

interface LanguageSwitcherProps {
  dropUp?: boolean;
}

export const LanguageSwitcher = ({ dropUp = false }: LanguageSwitcherProps) => {
  const { lang, setLang, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: Event) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLanguageChange = (langCode: Language) => {
    setLang(langCode);
    setIsOpen(false);
  };

  const currentLang = languages.find((item) => item.code === lang) ?? languages[0];

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-white transition-colors hover:bg-white/8"
        aria-label="Switch language"
        aria-expanded={isOpen}
      >
        <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" />
          <ellipse cx="12" cy="12" rx="4" ry="10" />
          <path d="M2 12h20" />
          <path d="M4.5 7h15" />
          <path d="M4.5 17h15" />
        </svg>
        <span className="text-xs font-medium">{currentLang.short}</span>
        <svg className="w-3 h-3 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dropUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute right-0 z-[80] w-40 overflow-hidden rounded-xl border border-white/15 bg-[#151515] shadow-lg ${
          dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          {languages.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => handleLanguageChange(language.code)}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/8 ${
                currentLang.code === language.code
                  ? 'bg-white/8 font-medium text-white'
                  : 'text-white/60'
              }`}
            >
              {language.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
