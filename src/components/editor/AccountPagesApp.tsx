'use client';

// Account-area island entry (docs/archive/CONSOLIDATION_PLAN.md M4): /plans
// and /success. Sibling of MyDesignsApp — same client-only providers
// (react-query, react-i18next side-effect init, Google Fonts / Material
// Symbols) without the Konva canvas editor, so the chunk stays small.
//
// Rendered as a full-viewport overlay above the Gallery chrome (same z-[70]
// layer as the editor island) because the ported IMAGINE pages bring their own
// header/footer. The overlay owns its scrolling; the page behind it stays empty.
//
// /mypage (the ported IMAGINE account page, formerly rendered here as
// <MyPage />) was retired in favor of the Gallery-native /account page —
// /app/mypage/page.tsx now redirects there server-side.

import { EditorQueryProvider } from './EditorQueryProvider';
import { useEditorFonts } from './lib/fonts';
import { PlansPage } from './pages/PlansPage';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { useEditorLanguageSync } from './i18n/useLanguageSync';

export type AccountPage = 'plans' | 'success';

export function AccountPagesApp({ page }: { page: AccountPage }) {
  useEditorFonts();
  useEditorLanguageSync();

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#101010]">
      <EditorQueryProvider>
        {page === 'plans' ? <PlansPage /> : <PaymentSuccess />}
      </EditorQueryProvider>
    </div>
  );
}
