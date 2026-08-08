'use client';

import { useEditorFonts } from './lib/fonts';
import { ImagineLandingPage } from './pages/ImagineLandingPage';
import { useEditorLanguageSync } from './i18n/useLanguageSync';

export function ImagineLandingApp() {
  useEditorFonts();
  useEditorLanguageSync();

  return <ImagineLandingPage />;
}
