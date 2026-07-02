'use client';

// Client boundary that disables prerendering for the My Designs island.
// Same pattern as EditClientOnly: `ssr: false` must live inside a Client
// Component, so the server page renders this thin wrapper and the react-query
// / i18next runtime only ever loads in the browser.

import dynamic from 'next/dynamic';

const MyDesignsApp = dynamic(() => import('./MyDesignsApp').then((mod) => mod.MyDesignsApp), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#101010]">
      <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
  ),
});

export function MyDesignsClientOnly() {
  return <MyDesignsApp />;
}
