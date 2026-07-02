'use client';

// Client boundary that disables prerendering for the admin-area island
// (/admin*, /mydesign/factory). Same pattern as MyDesignsClientOnly.

import dynamic from 'next/dynamic';
import type { AdminPage } from './AdminPagesApp';

const AdminPagesApp = dynamic(
  () => import('./AdminPagesApp').then((mod) => mod.AdminPagesApp),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#101010]">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    ),
  },
);

export function AdminPagesClientOnly({ page }: { page: AdminPage }) {
  return <AdminPagesApp page={page} />;
}
