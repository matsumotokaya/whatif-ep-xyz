'use client';

import { useEditorFonts } from './lib/fonts';
import { ImagineLandingPage } from './pages/ImagineLandingPage';
import './i18n';

export function ImagineLandingApp() {
  useEditorFonts();

  return <ImagineLandingPage />;
}
