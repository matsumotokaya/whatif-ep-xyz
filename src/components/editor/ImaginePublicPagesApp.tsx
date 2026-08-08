'use client';

import { useEditorFonts } from './lib/fonts';
import { AboutUs } from './pages/AboutUs';
import { PrivacyPolicy } from './pages/legal/PrivacyPolicy';
import { SecurityPolicy } from './pages/legal/SecurityPolicy';
import { TermsOfService } from './pages/legal/TermsOfService';
import { Tokushoho } from './pages/legal/Tokushoho';
import { useEditorLanguageSync } from './i18n/useLanguageSync';

// 'contact' was retired from here — /imagine/contact now renders a
// WHATIF-toned page directly (src/app/imagine/contact/ContactPageClient.tsx)
// instead of the ported IMAGINE Contact page, to stop the double
// header/footer stack (this app's pages bring their own IMAGINE chrome via
// PublicPageLayout, on top of the Gallery shell's own Header/Footer).
// about/privacy/security/terms/commercial still have that same double-chrome
// issue and are unchanged for now.
export type ImaginePublicPage =
  | 'about'
  | 'privacy'
  | 'security'
  | 'terms'
  | 'commercial';

function renderPage(page: ImaginePublicPage) {
  switch (page) {
    case 'about':
      return <AboutUs />;
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
  useEditorLanguageSync();
  return renderPage(page);
}
