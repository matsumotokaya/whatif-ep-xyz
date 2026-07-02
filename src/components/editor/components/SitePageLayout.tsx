'use client';

// Shared dark page shell for the ported IMAGINE site pages (M4):
// IMAGINE Header on top, page content in a centered column, IMAGINE Footer.
//
// Note on mainClassName: unlike the IMAGINE original (which relied on
// tailwind-merge to let callers override the default padding), the default
// vertical padding is applied ONLY when the caller does not pass
// mainClassName, so the local `cn` helper never has to resolve conflicting
// utilities.

import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { cn } from '../utils/cn';

interface SitePageLayoutProps {
  children: ReactNode;
  maxWidthClassName?: string;
  mainClassName?: string;
}

export function SitePageLayout({
  children,
  maxWidthClassName = 'max-w-6xl',
  mainClassName,
}: SitePageLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#101010]">
      <Header />
      <main className={cn('flex-1 px-4', mainClassName ?? 'py-8 sm:px-6')}>
        <div className={cn('mx-auto w-full', maxWidthClassName)}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
