'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import i18n from './index';

// The editor shell (ported from IMAGINE) runs its own react-i18next instance
// with its own localStorage key ("banalist_language", set in ./index.ts),
// completely separate from the Gallery's LanguageContext ("whatif_menu_locale").
// Switching language in the Gallery header never touched that second key, so
// any editor-shell page (mypage/plans/success/admin/edit/mydesign/...) would
// silently fall back to react-i18next's English default.
//
// This hook makes the editor shell's active language DERIVE from the shared
// LanguageContext instead of maintaining independent state — call it once
// from each island entry component (alongside useEditorFonts()).
export function useEditorLanguageSync() {
  const { lang } = useLanguage();

  useEffect(() => {
    if (i18n.language !== lang) {
      void i18n.changeLanguage(lang);
    }
  }, [lang]);
}
