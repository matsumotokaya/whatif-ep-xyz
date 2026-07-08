'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useEditorFonts } from './lib/fonts';
import { useParams } from './lib/router';
import { TemplateGallery } from './pages/TemplateGallery';
import { TemplatesBySize } from './pages/TemplatesBySize';
import './i18n';

export function ImagineTemplatesApp() {
  useEditorFonts();
  const { sizeKey } = useParams<{ sizeKey: string }>();

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#101010]">
      <QueryClientProvider client={queryClient}>
        {sizeKey ? <TemplatesBySize /> : <TemplateGallery />}
      </QueryClientProvider>
    </div>
  );
}
