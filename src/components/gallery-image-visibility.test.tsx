import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkCard } from './WorkCard';
import { EpisodeDetailImage } from './EpisodeDetailImage';
import type { WorkListItem } from '@/lib/types';

vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ lang: 'en' }) }));
vi.mock('@/components/SaveButton', () => ({ SaveButton: () => null }));
vi.stubGlobal('React', React);
const work: WorkListItem = {
  id: 'test', seriesSlug: 'episode', displayCode: '0457', title: 'Test',
  themeCategory: '', tags: [], sequenceNumber: 457,
  feedThumbUrl: 'https://assets.whatif-ep.xyz/test.webp', imageCandidates: [],
  hasWallpaperOffer: false, hasStarterOffer: false,
};

// Exercise the real Next Image output before hydration. Cached/downloaded
// pixels must not depend on a JS callback to become visible.
describe('gallery images before hydration', () => {
  it('renders a visible eager image for the first row', () => {
    const html = renderToStaticMarkup(<WorkCard work={work} eager />);
    const img = html.match(/<img\b[^>]*>/)?.[0] ?? '';
    expect(img).toContain('loading="eager"');
    expect(img).not.toMatch(/opacity-0|visibility:hidden|display:none/);
  });
  it('keeps offscreen cards lazy without hiding their pixels', () => {
    const html = renderToStaticMarkup(<WorkCard work={work} />);
    const img = html.match(/<img\b[^>]*>/)?.[0] ?? '';
    expect(img).toContain('loading="lazy"');
    expect(img).not.toContain('opacity-0');
  });
  it('renders the main artwork visibly before client JavaScript starts', () => {
    const html = renderToStaticMarkup(<EpisodeDetailImage candidates={[work.feedThumbUrl!]} alt="Test" />);
    const img = html.match(/<img\b[^>]*>/)?.[0] ?? '';
    expect(img).toContain('src="https://assets.whatif-ep.xyz/test.webp"');
    expect(img).not.toMatch(/opacity-0|visibility:hidden|display:none/);
  });
});
