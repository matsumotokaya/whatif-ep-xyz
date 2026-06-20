"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

export function LanguageSwitcher() {
  const { lang, setLang, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: Event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const current =
    languages.find((item) => item.code === lang) ?? languages[0];

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="btn-press flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-foreground transition-colors hover:bg-surface-hover"
        aria-label="Switch language"
        aria-expanded={isOpen}
      >
        <svg
          className="h-4 w-4 shrink-0 text-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <circle cx="12" cy="12" r="10" />
          <ellipse cx="12" cy="12" rx="4" ry="10" />
          <path d="M2 12h20" />
          <path d="M4.5 7h15" />
          <path d="M4.5 17h15" />
        </svg>
        <span className="text-xs font-medium">{current.short}</span>
        <svg
          className={`h-3 w-3 shrink-0 text-muted transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="dropdown-enter absolute right-0 top-full z-[80] mt-2 w-40 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setLang(item.code);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover ${
                current.code === item.code
                  ? "bg-surface-hover font-medium text-foreground"
                  : "text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
