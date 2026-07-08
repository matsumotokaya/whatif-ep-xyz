'use client';

// Admin-area island entry (docs/archive/CONSOLIDATION_PLAN.md M4): /admin,
// /admin/content-factory, /admin/cover-lab, /admin/storage-cleanup and the
// admin-only /mydesign/factory list. All pages are admin-gated, so sharing a
// single chunk across them is acceptable.
//
// Rendered as a full-viewport overlay above the Gallery chrome (same z-[70]
// layer as the editor island) because the ported IMAGINE pages bring their own
// header/footer.

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useEditorFonts } from './lib/fonts';
import { AdminDashboard } from './pages/AdminDashboard';
import { ContentFactory } from './pages/ContentFactory';
import { CoverLab } from './pages/CoverLab';
import { StorageCleanup } from './pages/StorageCleanup';
import { FactoryProjectManager } from './pages/FactoryProjectManager';
import './i18n';

export type AdminPage =
  | 'dashboard'
  | 'content-factory'
  | 'cover-lab'
  | 'storage-cleanup'
  | 'factory-projects';

function renderPage(page: AdminPage) {
  switch (page) {
    case 'content-factory':
      return <ContentFactory />;
    case 'cover-lab':
      return <CoverLab />;
    case 'storage-cleanup':
      return <StorageCleanup />;
    case 'factory-projects':
      return <FactoryProjectManager />;
    default:
      return <AdminDashboard />;
  }
}

export function AdminPagesApp({ page }: { page: AdminPage }) {
  useEditorFonts();

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#101010]">
      <QueryClientProvider client={queryClient}>
        {renderPage(page)}
      </QueryClientProvider>
    </div>
  );
}
