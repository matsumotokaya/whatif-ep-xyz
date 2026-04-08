"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const IMG = "/img/artwork_falling";

interface LayerDef {
  file: string;
  w: number;
  h: number;
  speed: number;
  fill?: boolean;
  className: string;
  style: React.CSSProperties;
  priority?: boolean;
  wrapperClass?: string;
}

const LAYERS: LayerDef[] = [
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
  {
    file: "11_bler001.png",
    w: 800,
    h: 973,
    speed: 0.05,
    className: "w-full h-auto",
    style: { top: "-21%", left: "-20%", width: "44%" },
  },
  {
    file: "08_text_WHATIF_001.png",
    w: 2500,
    h: 501,
    speed: 0.15,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-whatif",
  },
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
  {
    file: "06_sp_001.png",
    w: 214,
    h: 148,
    speed: 0.35,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-sp1",
  },
  {
    file: "05_sp_002.png",
    w: 454,
    h: 545,
    speed: 0.3,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-sp2",
  },
  {
    file: "04_items_001.png",
    w: 495,
    h: 675,
    speed: 0.4,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-items",
  },
  {
    file: "03_bag_001.png",
    w: 611,
    h: 750,
    speed: 0.35,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-bag",
  },
  {
    file: "02_glasses_001.png",
    w: 205,
    h: 144,
    speed: 0.45,
    className: "w-full h-auto",
    style: {},
    wrapperClass: "parallax-glasses",
  },
];

export function ParallaxHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(0);

  const priorityCount = LAYERS.filter((l) => l.priority).length;

  const handleImageLoad = () => {
    loadedRef.current += 1;
    if (loadedRef.current >= priorityCount) {
      setReady(true);
    }
  };

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
      const heroRange = window.innerHeight * 0.65;
      const progress = Math.min(scrollY / heroRange, 1);

      layers.forEach((el) => {
        const speed = Number(el.dataset.parallaxSpeed);
        el.style.transform = `translate3d(0,${-scrollY * speed}px,0)`;
      });

      if (scrollIndicatorRef.current) {
        const opacity = Math.max(0, 1 - progress * 6);
        scrollIndicatorRef.current.style.opacity = String(opacity);
      }

      if (ctaRef.current) {
        const ctaOpacity = Math.min(1, Math.max(0, (progress - 0.82) * 12));
        ctaRef.current.style.opacity = String(ctaOpacity);
        ctaRef.current.style.pointerEvents =
          ctaOpacity > 0.3 ? "auto" : "none";
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
    <div style={{ height: "165vh", marginTop: "-3.5rem" }}>
      <section
        ref={sectionRef}
        className="sticky top-0 h-svh w-full overflow-hidden bg-background"
      >
        {/* Loading screen */}
        <div
          className={`absolute inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-700 ease-out ${
            ready ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <span className="text-xl font-bold tracking-[0.3em] text-foreground">
            WHATIF
          </span>
          <div className="mt-6 h-px w-16 overflow-hidden rounded-full bg-border">
            <div className="h-full w-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/30 to-transparent" style={{ backgroundSize: "200% 100%" }} />
          </div>
        </div>

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
                onLoad={layer.priority ? handleImageLoad : undefined}
              />
            ) : (
              <Image
                src={`${IMG}/${layer.file}`}
                alt=""
                width={layer.w}
                height={layer.h}
                className={layer.className}
                priority={layer.priority ?? false}
                onLoad={layer.priority ? handleImageLoad : undefined}
              />
            )}
          </div>
        ))}

        {/* Scroll indicator */}
        <div
          ref={scrollIndicatorRef}
          className="absolute inset-x-0 bottom-10 flex justify-center transition-none"
          style={{ zIndex: LAYERS.length + 1 }}
        >
          <div className="relative h-20 w-0.5 overflow-hidden bg-foreground/20">
            <div className="animate-scroll-line absolute inset-x-0 h-1/2 rounded-full bg-foreground/70" />
          </div>
        </div>

        {/* CTA */}
        <div
          ref={ctaRef}
          className="absolute inset-x-0 bottom-12 flex flex-col items-center"
          style={{
            zIndex: LAYERS.length + 2,
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <Link
            href="/episodes"
            className="btn-press inline-flex items-center gap-2 rounded-lg bg-foreground px-10 py-4 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
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
