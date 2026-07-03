'use client';

// Client boundary that disables prerendering for the account-area island
// (/mypage, /plans, /success). Same pattern as MyDesignsClientOnly: the
// `ssr: false` dynamic import must live inside a Client Component.

import dynamic from 'next/dynamic';
import type { AccountPage } from './AccountPagesApp';

const AccountPagesApp = dynamic(
  () => import('./AccountPagesApp').then((mod) => mod.AccountPagesApp),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#101010]">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    ),
  },
);

export function AccountPagesClientOnly({ page }: { page: AccountPage }) {
  return <AccountPagesApp page={page} />;
}
