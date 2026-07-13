import { useEffect, useState } from 'react';
import { useSearchParams } from '@/components/editor/lib/router';

// Studio is the canonical editor. The Stories (touch-gesture, constrained) shell
// is shown ONLY on phones. Tablets, touch laptops, and desktops all get Studio.
//
// Why input capability decides this, not viewport width alone:
//  - Stories replaces the resize/rotate handles with 2-finger pinch/twist, so it
//    must NEVER be shown to a mouse-only device (a narrow desktop window included)
//    or the user could not resize/rotate at all.
//  - A coarse pointer alone is not enough either: tablets are touch devices but
//    have plenty of room for the full Studio, and the product treats tablets as
//    Studio. So Stories requires touch AND a phone-sized screen.
//
// A phone is therefore detected as: primary pointer is coarse (touch) AND the
// SHORTER viewport side is below PHONE_MAX_SHORT_SIDE. Using the shorter side
// makes the check orientation-independent — a landscape phone still qualifies,
// while a tablet never does (its shorter side stays well above the threshold).
const POINTER_COARSE_MEDIA_QUERY = '(pointer: coarse)';

// Phone shorter sides top out around ~430px (large phones) and even foldables
// closed stay under ~500px; the smallest tablets start around ~744-768px. 600px
// sits in the empty gap between the two clusters.
export const PHONE_MAX_SHORT_SIDE = 600;

export interface PhoneViewportInput {
  pointerCoarse: boolean;
  width: number;
  height: number;
}

// Pure phone classifier (unit-tested). Kept separate from the DOM reads so the
// device matrix can be exercised without a browser.
export function isPhoneViewport({ pointerCoarse, width, height }: PhoneViewportInput): boolean {
  if (!pointerCoarse) return false;
  return Math.min(width, height) < PHONE_MAX_SHORT_SIDE;
}

// Session key that persists the `?stories=1` / `?stories=0` dev override.
// Opening a template via `?template=<id>` internally navigates to
// `/edit/<bannerId>`, which drops the query string; without persistence a forced
// override would silently reset the moment the template finishes loading. Real
// phones never rely on this (they auto-detect), so it is purely a testing
// affordance for desktop DevTools.
const STORIES_OVERRIDE_SESSION_KEY = 'whatif_editor_stories_override';

// Returns the persisted dev override: true (forced Stories), false (forced
// Studio), or null (no override — fall back to auto detection).
function readStoredOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const stored = window.sessionStorage.getItem(STORIES_OVERRIDE_SESSION_KEY);
  if (stored === '1') return true;
  if (stored === '0') return false;
  return null;
}

function detectPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return isPhoneViewport({
    pointerCoarse: window.matchMedia(POINTER_COARSE_MEDIA_QUERY).matches,
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

// Decides whether the editor should render the Stories (phone) shell.
//
// Precedence:
//  1. `?stories=1` / `?stories=0` dev override (session-persisted; `1` forces
//     Stories, `0` forces Studio, at any device). Lets DevTools exercise either
//     shell without device emulation and survives the /edit/<id> navigation.
//  2. Auto: phone detection (coarse pointer AND phone-sized shorter side).
export function useStoriesMode(): boolean {
  const [searchParams] = useSearchParams();
  const storiesParam = searchParams.get('stories');

  const [override, setOverride] = useState<boolean | null>(readStoredOverride);
  useEffect(() => {
    if (storiesParam === '1') {
      window.sessionStorage.setItem(STORIES_OVERRIDE_SESSION_KEY, '1');
      setOverride(true);
    } else if (storiesParam === '0') {
      window.sessionStorage.setItem(STORIES_OVERRIDE_SESSION_KEY, '0');
      setOverride(false);
    } else {
      setOverride(readStoredOverride());
    }
  }, [storiesParam]);

  const [isPhone, setIsPhone] = useState<boolean>(detectPhone);
  useEffect(() => {
    const update = () => setIsPhone(detectPhone());
    update();
    const pointerQuery = window.matchMedia(POINTER_COARSE_MEDIA_QUERY);
    pointerQuery.addEventListener('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      pointerQuery.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (override !== null) return override;
  return isPhone;
}
