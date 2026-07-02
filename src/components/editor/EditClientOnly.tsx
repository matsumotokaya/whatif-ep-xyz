'use client';

// Client boundary that disables prerendering for the editor island.
// `ssr: false` must live inside a Client Component (see
// node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md), so the server
// page renders this thin wrapper and the Konva/dnd-kit/i18next runtime only
// ever loads in the browser.

import dynamic from 'next/dynamic';

const EditorApp = dynamic(() => import('./EditorApp').then((mod) => mod.EditorApp), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1e1e1e]">
      <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
  ),
});

export function EditClientOnly() {
  return <EditorApp />;
}
