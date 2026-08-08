import type { ReactNode } from "react";

// WHATIF-toned counterpart to the IMAGINE shell's PublicPageLayout
// (src/components/editor/components/PublicPageLayout.tsx). Used by the
// ported IMAGINE public pages (About / Privacy / Terms / Security /
// Tokushoho) so they render inside the Gallery shell (root layout Header +
// Footer) instead of bringing their own IMAGINE Header/Footer, which used to
// stack a second header/footer under the Gallery's own.
//
// The inner content card intentionally stays `bg-white` (not the `bg-surface`
// token) — the ported legal/about content components have their own
// `text-gray-700` / `text-gray-900` / `border-gray-200` classes calibrated
// against a literal white card, exactly like the IMAGINE original. Only the
// page-level chrome (background, title, description) switches to WHATIF
// tokens; the content itself is untouched.
interface WhatifPublicPageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
  maxWidthClassName?: string;
}

export function WhatifPublicPageLayout({
  title,
  description,
  children,
  contentClassName = "",
  maxWidthClassName = "max-w-4xl",
}: WhatifPublicPageLayoutProps) {
  return (
    <div className="w-full px-4 py-10 pt-24 sm:px-6 lg:px-8">
      <div className={`mx-auto w-full ${maxWidthClassName}`}>
        <div className="mb-8">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-pretty text-sm leading-7 text-muted sm:text-base">
              {description}
            </p>
          ) : null}
        </div>

        <div
          className={`rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8 ${contentClassName}`.trim()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
