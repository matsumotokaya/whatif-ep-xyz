"use client";

import { useEffect, useRef, useState } from "react";

interface MotionDetailVideoProps {
  src: string;
  poster: string | null;
  title: string;
  /** Show an unmute button (playback still starts muted per autoplay rules). */
  hasAudio?: boolean;
}

/**
 * Detail-page player for Motion works. Videos are silent loops, so they start
 * playing muted right away (browsers only allow muted autoplay). Tapping the
 * video pauses/resumes. With reduced motion requested it starts paused.
 */
export function MotionDetailVideo({ src, poster, title, hasAudio = false }: MotionDetailVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    void video.play().catch(() => setPaused(true));
  }, [src]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted && video.paused) void video.play();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        muted={muted}
        loop
        playsInline
        preload="auto"
        aria-label={title}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onClick={toggle}
        className="h-full w-full cursor-pointer object-contain"
      />
      {paused && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play"
          className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <svg aria-hidden="true" className="ml-1 h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l10.5-6.5z" />
          </svg>
        </button>
      )}
      {hasAudio && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={!muted}
          className="absolute bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" />
            {muted ? (
              <path d="M22 9l-6 6M16 9l6 6" />
            ) : (
              <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}
