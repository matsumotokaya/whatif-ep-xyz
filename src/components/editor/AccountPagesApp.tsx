'use client';

// Account-area island entry (docs/archive/CONSOLIDATION_PLAN.md M4): /success.
// Sibling of MyDesignsApp — same client-only providers (react-query,
// react-i18next side-effect init, Google Fonts / Material Symbols) without
// the Konva canvas editor, so the chunk stays small.
//
// Rendered as a full-viewport overlay above the Gallery chrome (same z-[70]
// layer as the editor island) because the ported IMAGINE pages bring their own
// header/footer. The overlay owns its scrolling; the page behind it stays empty.
//
// /mypage (the ported IMAGINE account page, formerly rendered here as
// <MyPage />) and /plans (formerly <PlansPage />) were retired in favor of
// Gallery-native pages — see src/app/mypage/page.tsx (redirects to /account)
// and src/app/plans/PlansPageClient.tsx.

import { EditorQueryProvider } from './EditorQueryProvider';
import { useEditorFonts } from './lib/fonts';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { useEditorLanguageSync } from './i18n/useLanguageSync';

export type AccountPage = 'success';

export function AccountPagesApp({ page: _page }: { page: AccountPage }) {
  useEditorFonts();
  useEditorLanguageSync();

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#101010]">
      <EditorQueryProvider>
        <PaymentSuccess />
      </EditorQueryProvider>
    </div>
  );
}
