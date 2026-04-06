"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

const IMG = "/img/artwork_falling";

interface LayerDef {
  file: string;
  w: number;
  h: number;
  /** px per scroll-px (0 = fixed, higher = moves more) */
  speed: number;
  fill?: boolean;
  className: string;
  style: React.CSSProperties;
  priority?: boolean;
  wrapperClass?: string;
}

/**
 * Background stays fixed (speed=0).
 * Elements move upward as user scrolls — higher speed = faster departure.
 */
const LAYERS: LayerDef[] = [
  // --- Background (fixed) ---
  {
    file: "12_bg.jpg",
    w: 2500,
    h: 1033,
    speed: 0,
    fill: true,
    className: "object-cover object-center",
    style: {},
    priority: true,
  },
  // --- Blur silhouette ---
  {
    file: "11_bler001.png",
    w: 800,
    h: 973,
    speed: 0.05,
    className: "w-full h-auto",
    style: { top: "-21%", left: "-20%", width: "44%" },
  },
  // --- Red text texture ---
  {
    file: "10_texr_red_001.png",
    w: 1135,
    h: 1167,
    speed: 0.08,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-redtext",
  },
  // --- Diagonal dashed line ---
  {
    file: "09_line_001.png",
    w: 1011,
    h: 2878,
    speed: 0.1,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-line",
  },
  // --- WHATIF logo text ---
  {
    file: "08_text_WHATIF_001.png",
    w: 2500,
    h: 501,
    speed: 0.15,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-whatif",
  },
  // --- Main character ---
  {
    file: "07_character_001_001.png",
    w: 2500,
    h: 1320,
    speed: 0.25,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-character",
    priority: true,
  },
  // --- Small dark phone ---
  {
    file: "06_sp_001.png",
    w: 214,
    h: 148,
    speed: 0.35,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-sp1",
  },
  // --- Phone with pink screen ---
  {
    file: "05_sp_002.png",
    w: 454,
    h: 545,
    speed: 0.3,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-sp2",
  },
  // --- Scattered devices ---
  {
    file: "04_items_001.png",
    w: 495,
    h: 675,
    speed: 0.4,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-items",
  },
  // --- Bag ---
  {
    file: "03_bag_001.png",
    w: 611,
    h: 750,
    speed: 0.35,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-bag",
  },
  // --- Glasses ---
  {
    file: "02_glasses_001.png",
    w: 205,
    h: 144,
    speed: 0.45,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-glasses",
  },
  // --- Message bubble (frontmost) ---
  {
    file: "01_message_001.png",
    w: 1002,
    h: 192,
    speed: 0.5,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-message",
  },
];

export function ParallaxHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const layers =
      section.querySelectorAll<HTMLElement>("[data-parallax-speed]");

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let ticking = false;

    const update = () => {
      const scrollY = window.scrollY;
      // Scroll range: outer div is 330vh, inner is 100vh → range is 230vh
      const heroRange = window.innerHeight * 2.3;
      const progress = Math.min(scrollY / heroRange, 1);

      // Move parallax layers upward
      layers.forEach((el) => {
        const speed = Number(el.dataset.parallaxSpeed);
        el.style.transform = `translate3d(0,${-scrollY * speed}px,0)`;
      });

      // Scroll indicator: fade out at start of scroll
      if (scrollIndicatorRef.current) {
        const opacity = Math.max(0, 1 - progress * 6);
        scrollIndicatorRef.current.style.opacity = String(opacity);
      }

      // CTA: fade in near the end (last ~15% of scroll)
      if (ctaRef.current) {
        const ctaOpacity = Math.min(1, Math.max(0, (progress - 0.82) * 12));
        ctaRef.current.style.opacity = String(ctaOpacity);
        ctaRef.current.style.pointerEvents = ctaOpacity > 0.3 ? "auto" : "none";
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // Outer: tall container gives scroll range (330vh = 100vh visible + 230vh scroll room)
    <div style={{ height: "330vh" }}>
      {/* Inner: sticky, stays fixed at viewport top while scrolling through outer */}
      <section
        ref={sectionRef}
        className="sticky top-0 h-svh w-full overflow-hidden bg-background"
      >
        {/* Parallax layers */}
        {LAYERS.map((layer, i) => (
          <div
            key={layer.file}
            data-parallax-speed={layer.speed}
            className={`absolute will-change-transform ${layer.fill ? "inset-0" : ""} ${layer.wrapperClass ?? ""}`}
            style={{ zIndex: i + 1, ...(!layer.fill ? layer.style : {}) }}
          >
            {layer.fill ? (
              <Image
                src={`${IMG}/${layer.file}`}
                alt=""
                fill
                className={layer.className}
                priority={layer.priority ?? false}
              />
            ) : (
              <Image
                src={`${IMG}/${layer.file}`}
                alt=""
                width={layer.w}
                height={layer.h}
                className={layer.className}
                priority={layer.priority ?? false}
              />
            )}
          </div>
        ))}

        {/* Scroll indicator — visible initially, fades out on scroll */}
        <div
          ref={scrollIndicatorRef}
          className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-2 transition-none"
          style={{ zIndex: LAYERS.length + 1 }}
        >
          <span className="text-[10px] tracking-[0.3em] text-foreground/60 uppercase">
            Scroll
          </span>
          <div className="animate-bounce">
            <svg
              className="h-5 w-5 text-foreground/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* CTA — hidden initially, fades in near end of scroll */}
        <div
          ref={ctaRef}
          className="absolute inset-x-0 bottom-12 flex flex-col items-center"
          style={{ zIndex: LAYERS.length + 2, opacity: 0, pointerEvents: "none" }}
        >
          <Link
            href="/episodes"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-10 py-4 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
          >
            <span>Enter Gallery</span>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
