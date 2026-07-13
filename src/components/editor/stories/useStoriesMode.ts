import { useEffect, useState } from 'react';
import { useSearchParams } from '@/components/editor/lib/router';

// Same breakpoint the editor has always used for its mobile branch
// (window.innerWidth < 768, see the former DesktopRecommendedModal trigger).
const STORIES_MAX_WIDTH_MEDIA_QUERY = '(max-width: 767px)';

// Session key that persists the `?stories=1` dev override. Opening a template
// via `?template=<id>` internally navigates to `/edit/<bannerId>`, which drops
// the query string; without persistence the forced Stories mode would silently
// switch off the moment the template finishes loading. Real phones never rely
// on this (they trigger Stories via viewport width), so this is purely a
// desktop-DevTools affordance.
const STORIES_OVERRIDE_SESSION_KEY = 'whatif_editor_stories_override';

function readStoredOverride(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(STORIES_OVERRIDE_SESSION_KEY) === '1';
}

// Decides whether the editor should render the Stories (mobile) shell.
//
// - Viewport narrower than 768px -> Stories mode.
// - `?stories=1` forces Stories mode at any width and is remembered for the tab
//   session (survives the internal /edit/<id> navigation, which drops the query
//   string). `?stories=0` clears it. This is a development affordance so the
//   mobile shell can be exercised in desktop DevTools without toggling device
//   emulation.
export function useStoriesMode(): boolean {
  const [searchParams] = useSearchParams();
  const storiesParam = searchParams.get('stories');

  const [forced, setForced] = useState<boolean>(readStoredOverride);
  useEffect(() => {
    if (storiesParam === '1') {
      window.sessionStorage.setItem(STORIES_OVERRIDE_SESSION_KEY, '1');
      setForced(true);
    } else if (storiesParam === '0') {
      window.sessionStorage.removeItem(STORIES_OVERRIDE_SESSION_KEY);
      setForced(false);
    } else {
      setForced(readStoredOverride());
    }
  }, [storiesParam]);

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
