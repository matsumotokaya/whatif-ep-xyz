import { useEffect, useState } from 'react';
import { useSearchParams } from '@/components/editor/lib/router';

// Same breakpoint the editor has always used for its mobile branch
// (window.innerWidth < 768, see the former DesktopRecommendedModal trigger).
const STORIES_MAX_WIDTH_MEDIA_QUERY = '(max-width: 767px)';

// Decides whether the editor should render the Stories (mobile) shell.
//
// - Viewport narrower than 768px -> Stories mode.
// - `?stories=1` forces Stories mode at any width. This is a development
//   affordance so the mobile shell can be exercised in desktop DevTools
//   without toggling device emulation.
export function useStoriesMode(): boolean {
  const [searchParams] = useSearchParams();
  const forced = searchParams.get('stories') === '1';

  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(STORIES_MAX_WIDTH_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(STORIES_MAX_WIDTH_MEDIA_QUERY);
    const handleChange = () => setIsNarrow(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return forced || isNarrow;
}
