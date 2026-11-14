"use client";

import { useEffect, type RefObject } from "react";

/**
 * Pinterest-style scroll-linked bar. The element moves 1:1 with the scroll:
 * scrolling down pushes it up out of view as if it were page content, and
 * scrolling back up pulls it down again by exactly the distance scrolled, from
 * anywhere on the page. A partially revealed bar stays where the scroll stopped.
 *
 * The element should be `position: sticky` directly under the fixed header.
 * Styles are written straight to the DOM so scrolling never re-renders React.
 */
export function useHideOnScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let height = element.offsetHeight;
    let offset = 0;
    let lastY = Math.max(0, window.scrollY);
    let frame = 0;

    const apply = (y: number) => {
      element.style.transform = offset === 0 ? "" : `translateY(${offset}px)`;
      element.toggleAttribute("data-hidden", offset <= -height);
      element.toggleAttribute("data-scrolled", y > 0);
    };

    const update = () => {
      frame = 0;
      // iOS rubber-banding reports negative offsets; treat them as the top.
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;
      offset = y <= 0 ? 0 : Math.min(0, Math.max(-height, offset - delta));
      apply(y);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const resizeObserver = new ResizeObserver(() => {
      height = element.offsetHeight;
      offset = Math.max(-height, offset);
      apply(Math.max(0, window.scrollY));
    });
    resizeObserver.observe(element);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      element.style.transform = "";
    };
  }, [ref]);
}
