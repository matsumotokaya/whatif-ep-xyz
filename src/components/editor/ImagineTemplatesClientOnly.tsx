'use client';

import dynamic from 'next/dynamic';

const ImagineTemplatesApp = dynamic(
  () => import('./ImagineTemplatesApp').then((mod) => mod.ImagineTemplatesApp),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#101010]">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    ),
  }
);

export function ImagineTemplatesClientOnly() {
  return <ImagineTemplatesApp />;
}
