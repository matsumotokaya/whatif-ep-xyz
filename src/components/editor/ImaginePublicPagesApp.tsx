'use client';

import { useEditorFonts } from './lib/fonts';
import { AboutUs } from './pages/AboutUs';
import { Contact } from './pages/Contact';
import { PrivacyPolicy } from './pages/legal/PrivacyPolicy';
import { SecurityPolicy } from './pages/legal/SecurityPolicy';
import { TermsOfService } from './pages/legal/TermsOfService';
import { Tokushoho } from './pages/legal/Tokushoho';
import './i18n';

export type ImaginePublicPage =
  | 'about'
  | 'contact'
  | 'privacy'
  | 'security'
  | 'terms'
  | 'commercial';

function renderPage(page: ImaginePublicPage) {
  switch (page) {
    case 'about':
      return <AboutUs />;
    case 'contact':
      return <Contact />;
    case 'privacy':
      return <PrivacyPolicy />;
    case 'security':
      return <SecurityPolicy />;
    case 'terms':
      return <TermsOfService />;
    case 'commercial':
      return <Tokushoho />;
    default:
      return null;
  }
}

export function ImaginePublicPagesApp({ page }: { page: ImaginePublicPage }) {
  useEditorFonts();
  return renderPage(page);
}
